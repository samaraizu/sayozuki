/**
 * HP（Worker「sayozuki」）からの予約と事前決済。
 * HPからはサービスバインディングの RPC（index.ts の HpApi）でしか呼べない。インターネットには出していない。
 *
 * 流れ
 * 1. startCheckout：空室を確かめながら bookings に「仮」で1行入れて部屋を押さえ、Squareの支払いリンクを作る
 * 2. お客様が Square で払う → HPの完了画面に戻る → checkoutStatus が Square に聞いて「確定」にする
 * 3. 戻ってこなくても、毎分の sweep が Square に聞いて確定する。HOLD_MINUTES を過ぎて払われていなければ、
 *    支払いリンクを消し、仮の行を消して部屋を戻す
 *
 * 料金はHPが決める（lib/pricing.ts）。ここは受け取った明細の合計と額が合っているかだけ確かめる。
 */
import { Lib } from './lib.gen.js';
import { innAddresses, sendMail } from './mail';
import { createPaymentLink, deletePaymentLink, orderPaid, type PayLine } from './square';
import { todayIso, type Env } from './env';

export const HOLD_MINUTES = 30;
export const PAID_LABEL = 'HPで決済済';
const MAX_NIGHTS = 30;

export interface CalendarData {
  today: string;
  until: string;
  rooms: { name: string; capacity: number; state: string; booked: string[] }[];
}

/** 空室表示用。部屋ごとの状態・定員と、埋まっている夜（キャンセル以外。決済待ちの仮も含む） */
export async function calendar(env: Env, days = 180): Promise<CalendarData> {
  const today = todayIso();
  const span = Math.min(Math.max(Math.floor(days) || 180, 1), 400);
  const until = Lib.addDays(today, span);
  const [rooms, bookings] = await Promise.all([
    env.DB.prepare('SELECT name, capacity, state FROM rooms ORDER BY sort, name').all<{ name: string; capacity: number; state: string }>(),
    env.DB.prepare(
      `SELECT room, check_in, check_out FROM bookings
       WHERE status <> 'キャンセル' AND room <> '' AND check_in <> '' AND check_out <> '' AND check_out > ?1 AND check_in < ?2`,
    )
      .bind(today, until)
      .all<{ room: string; check_in: string; check_out: string }>(),
  ]);
  return { today, until, rooms: occupancy(rooms.results, bookings.results, today, until) };
}

export function occupancy(
  rooms: { name: string; capacity: number; state: string }[],
  bookings: { room: string; check_in: string; check_out: string }[],
  from: string,
  until: string,
) {
  const booked = new Map<string, Set<string>>();
  for (const r of rooms) booked.set(String(r.name), new Set());
  for (const b of bookings) {
    const set = booked.get(b.room);
    if (!set || !(b.check_in < b.check_out)) continue;
    let night = b.check_in < from ? from : b.check_in;
    for (let i = 0; night < b.check_out && night < until && i < 400; i++) {
      set.add(night);
      night = Lib.addDays(night, 1);
    }
  }
  return rooms.map((r) => ({
    name: String(r.name),
    capacity: Number(r.capacity) || 0,
    state: String(r.state || '停止'),
    booked: [...(booked.get(String(r.name)) ?? [])].sort(),
  }));
}

export interface CheckoutInput {
  room: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  tel: string;
  arrival: string;
  /** 「朝食」「朝食・夕食」など。なしは空 */
  meals: string;
  memo: string;
  lang: string;
  lines: PayLine[];
  amount: number;
  /** HPの完了画面のURL。?no=…&key=… を足して Square からここへ戻す */
  returnUrl: string;
  /** 払われたときに送るメール（HPが言語に合わせて作る） */
  mail: { guestSubject: string; guestBody: string; innSubject: string; innBody: string };
}

export type CheckoutResult =
  | { ok: true; no: string; key: string; url: string }
  | { ok: false; code: 'invalid' | 'unavailable' | 'payment_error'; message?: string };

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

/** 入力の形を確かめる。問題なければ null */
export function checkInput(input: CheckoutInput, today: string): string | null {
  const inIso = Lib.toIso(input.checkIn);
  const outIso = Lib.toIso(input.checkOut);
  const nights = Lib.nightsBetween(inIso, outIso);
  if (!inIso || !outIso || nights < 1 || nights > MAX_NIGHTS) return 'dates';
  if (inIso < today) return 'past';
  if (!clip(input.room, 50)) return 'room';
  const guests = Math.floor(Number(input.guests));
  if (!(guests >= 1 && guests <= 20)) return 'guests';
  if (!clip(input.name, 100)) return 'name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clip(input.email, 200))) return 'email';
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 20) return 'lines';
  let sum = 0;
  for (const l of input.lines) {
    const q = Number(l.quantity), u = Number(l.unitAmount);
    if (!clip(l.name, 200) || !Number.isInteger(q) || q < 1 || !Number.isInteger(u) || u < 0) return 'lines';
    sum += q * u;
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0 || sum !== input.amount) return 'amount';
  if (!/^https?:\/\//.test(String(input.returnUrl))) return 'returnUrl';
  return null;
}

function randomKey() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function startCheckout(env: Env, input: CheckoutInput, now = new Date()): Promise<CheckoutResult> {
  const today = todayIso(now);
  const problem = checkInput(input, today);
  if (problem) return { ok: false, code: 'invalid', message: problem };

  const inIso = Lib.toIso(input.checkIn);
  const outIso = Lib.toIso(input.checkOut);
  const room = clip(input.room, 50);
  const guests = Math.floor(Number(input.guests));
  const name = clip(input.name, 100);
  const email = clip(input.email, 200);
  const tel = clip(input.tel, 50);

  const prefix = 'SZ-' + today.replace(/-/g, '') + '-';
  const { results } = await env.DB.prepare('SELECT no FROM bookings WHERE no LIKE ?').bind(prefix + '%').all<{ no: string }>();
  const existing: Record<string, boolean> = {};
  for (const r of results) existing[r.no] = true;
  const no = Lib.makeBookingNo(today, existing);
  const key = randomKey();
  const expires = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
  const memo = [`HP予約・事前決済 ${input.amount.toLocaleString('ja-JP')}円`, clip(input.memo, 1000)].filter(Boolean).join('\n');

  // 空室の確認と押さえを1つの文で（手動入力と同じ条件）。入らなければ誰かが先に押さえている
  const hold = env.DB.prepare(
    `INSERT INTO bookings (no, source, channel, status, room, check_in, check_out, adults, name, contact, arrival, meals,
       guest_paid, payment, memo, booked_on, created_by)
     SELECT ?1, 'app', '直販', '仮', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, '未収', ?11, ?12, 'hp'
     WHERE EXISTS (SELECT 1 FROM rooms WHERE name = ?2 AND state = '販売可' AND capacity >= ?13)
       AND NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE room = ?2 AND status <> 'キャンセル' AND check_in <> '' AND check_out <> ''
           AND check_in < ?4 AND ?3 < check_out
       )`,
  ).bind(
    no, room, inIso, outIso, String(guests), name, [tel, email].filter(Boolean).join(' / '),
    clip(input.arrival, 50), clip(input.meals, 50), String(input.amount), memo, today, guests,
  );
  const record = env.DB.prepare(
    `INSERT INTO hp_checkouts (no, view_key, amount, email, lang, summary, expires_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE EXISTS (SELECT 1 FROM bookings WHERE no = ?1 AND created_by = 'hp')`,
  ).bind(no, key, input.amount, email, clip(input.lang, 10) || 'ja', JSON.stringify(input.mail ?? {}), expires);
  const [res] = await env.DB.batch([hold, record]);
  if (!res.meta.changes) return { ok: false, code: 'unavailable' };

  const returnUrl = `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}no=${encodeURIComponent(no)}&key=${key}`;
  try {
    const link = await createPaymentLink(env, {
      no,
      lines: input.lines.map((l) => ({ name: clip(l.name, 200), quantity: l.quantity, unitAmount: l.unitAmount })),
      email,
      redirectUrl: returnUrl,
      note: `小夜月 ${no} ${room} ${inIso}〜${outIso}`,
    });
    await env.DB.prepare('UPDATE hp_checkouts SET link_id = ?2, order_id = ?3, pay_url = ?4 WHERE no = ?1')
      .bind(no, link.id, link.orderId, link.url)
      .run();
    await log(env, 'HP予約（決済待ち）', no, `${room} ${inIso}〜${outIso} ${guests}名 ${name} ${input.amount}円`);
    return { ok: true, no, key, url: link.url };
  } catch (e) {
    console.error('支払いリンクを作れなかった', e);
    await release(env, no, 'failed');
    return { ok: false, code: 'payment_error' };
  }
}

interface CheckoutRow {
  no: string;
  view_key: string;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  amount: number;
  email: string;
  lang: string;
  summary: string;
  link_id: string;
  order_id: string;
  pay_url: string;
  expires_at: string;
  mailed: number;
}

export interface CheckoutStatus {
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'unknown';
  no?: string;
  room?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  amount?: number;
  /** 決済待ちのとき、支払いページへ戻るURL */
  payUrl?: string;
}

/** 完了画面から。鍵が合えば、払われたかを Square に聞いて返す */
export async function checkoutStatus(env: Env, no: string, key: string, now = new Date()): Promise<CheckoutStatus> {
  const row = await env.DB.prepare('SELECT * FROM hp_checkouts WHERE no = ?').bind(String(no)).first<CheckoutRow>();
  if (!row || !key || !safeEqual(row.view_key, String(key))) return { status: 'unknown' };
  let status = row.status;
  if (status === 'pending') status = await settle(env, row, now);
  const b = await env.DB.prepare('SELECT room, check_in, check_out, adults FROM bookings WHERE no = ?')
    .bind(row.no)
    .first<{ room: string; check_in: string; check_out: string; adults: string }>();
  return {
    status,
    no: row.no,
    room: b?.room,
    checkIn: b?.check_in,
    checkOut: b?.check_out,
    guests: b ? Number(b.adults) || undefined : undefined,
    amount: row.amount,
    payUrl: status === 'pending' ? row.pay_url : undefined,
  };
}

/** 毎分。決済待ちを Square に聞いて確定するか、期限切れなら部屋を戻す */
export async function sweep(env: Env, now = new Date()) {
  const { results } = await env.DB.prepare("SELECT * FROM hp_checkouts WHERE status = 'pending' ORDER BY created_at LIMIT 25").all<CheckoutRow>();
  const out = { paid: 0, expired: 0, pending: 0 };
  for (const row of results) {
    const s = await settle(env, row, now);
    if (s === 'paid') out.paid++;
    else if (s === 'expired') out.expired++;
    else out.pending++;
  }
  return out;
}

/** 決済待ち1件の行き先を決める */
async function settle(env: Env, row: CheckoutRow, now: Date): Promise<CheckoutRow['status']> {
  let paid = false;
  try {
    paid = Boolean(row.order_id) && (await orderPaid(env, row.order_id));
  } catch (e) {
    console.error('支払いを確かめられなかった', row.no, e);
  }
  if (paid) {
    await confirm(env, row);
    return 'paid';
  }
  if (row.expires_at < now.toISOString()) {
    await deletePaymentLink(env, row.link_id);
    await release(env, row.no, 'expired');
    return 'expired';
  }
  return 'pending';
}

async function confirm(env: Env, row: CheckoutRow) {
  const [b, c] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE bookings SET status = '確定', payment = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE no = ?1 AND created_by = 'hp' AND status = '仮'`,
    ).bind(row.no, PAID_LABEL),
    env.DB.prepare(
      `UPDATE hp_checkouts SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE no = ?1 AND status = 'pending'`,
    ).bind(row.no),
  ]);
  if (!c.meta.changes) return; // ほかの呼び出しが先に確定した
  if (!b.meta.changes) {
    // 押さえが外れたあとに払われた（ふつうは支払いリンクを消すので起きない）。返金か手での予約が要る
    await log(env, 'HP予約：押さえの外れた予約に支払い', row.no, `${row.amount}円。返金するか、空いていれば手で予約を入れる`);
    await sendMail(env, innAddresses(env), `【小夜月】要対応：期限切れの予約 ${row.no} に支払いがありました`,
      `予約番号 ${row.no} は決済の期限が切れて部屋を戻したあとに、${row.amount.toLocaleString('ja-JP')}円が支払われました。\nSquare で返金するか、空いていれば予約管理から手で入れてください。`);
    return;
  }
  await log(env, 'HP予約（決済済）', row.no, `${row.amount}円`);

  // 確認メールは1回だけ
  const claim = await env.DB.prepare('UPDATE hp_checkouts SET mailed = 1 WHERE no = ? AND mailed = 0').bind(row.no).run();
  if (!claim.meta.changes) return;
  let mail: Partial<CheckoutInput['mail']> = {};
  try {
    mail = JSON.parse(row.summary || '{}');
  } catch {
    mail = {};
  }
  // HPは予約番号を知らないうちに文面を作るので、{no} をここで差し込む
  for (const k of ['guestSubject', 'guestBody', 'innSubject', 'innBody'] as const) {
    if (mail[k]) mail[k] = String(mail[k]).split('{no}').join(row.no);
  }
  const inn = innAddresses(env);
  if (mail.guestSubject && mail.guestBody && row.email) {
    await sendMail(env, row.email, mail.guestSubject, mail.guestBody, inn[0]);
  }
  if (mail.innSubject && mail.innBody) await sendMail(env, inn, mail.innSubject, mail.innBody, row.email || undefined);
}

/** 押さえを外す（仮の行を消す）。まだスプシに載っていない、HPの仮の行だけが対象 */
async function release(env: Env, no: string, status: 'expired' | 'failed') {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM bookings WHERE no = ?1 AND created_by = 'hp' AND status = '仮' AND in_sheet = 0").bind(no),
    env.DB.prepare("UPDATE hp_checkouts SET status = ?2 WHERE no = ?1 AND status = 'pending'").bind(no, status),
  ]);
  await log(env, status === 'expired' ? 'HP予約（期限切れで取り消し）' : 'HP予約（決済の準備に失敗）', no, '');
}

async function log(env: Env, action: string, no: string, detail: string) {
  await env.DB.prepare("INSERT INTO op_log (actor, action, no, detail) VALUES ('hp', ?, ?, ?)").bind(action, no, detail).run();
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
