/**
 * HP（Worker「sayozuki」）からの予約と事前決済。
 * HPからはサービスバインディングの RPC（index.ts の HpApi）でしか呼べない。インターネットには出していない。
 *
 * 流れ
 * 1. startCheckout：空室を確かめながら bookings に「仮」で1行入れて部屋を押さえ、Squareの支払いリンクを作る
 * 2. お客様が Square で払う → HPの完了画面に戻る → checkoutStatus が Square に聞いて「確定」にする
 * 3. 戻ってこなくても、毎分の sweep が Square に聞いて確定する。HOLD_MINUTES を過ぎて払われていなければ、
 *    支払いリンクを消し、仮の行を「キャンセル」にして部屋を戻す（申込みの記録として台帳には残す）。
 *    Square に聞けなかった・リンクを消せなかったときは押さえたまま次の回に回す（GIVE_UP_MINUTES まで）
 * 4. 部屋を戻したあとも LATE_WATCH_HOURS のあいだは支払いを見回り、払われていたら宿に知らせる
 * 確認メールは送れなかったら毎分の見回りで MAIL_TRIES 回まで送り直し、だめなら宿に知らせる
 * 押さえすぎ対策：同じ人（メール・送り元が同じ）が申し込み直したら前の押さえを外す。同じ送り元（IP）は決済待ち2件・1時間に6件まで
 * 仮のうちから台帳とGoogleカレンダーに出す（db.ts の pendingForSheet）。確定・取り消しは取り込みGASが台帳に書く
 *
 * 料金はHPが決める（lib/pricing.ts）。ここは受け取った明細の合計と額が合っているかだけ確かめる。
 */
import { Lib } from './lib.gen.js';
import { innAddresses, mailConfigured, sendMail } from './mail';
import { notify } from './push';

const md = (iso: string) => (iso ? `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}` : '?');
import { createPaymentLink, deletePaymentLink, orderPaid, type PayLine } from './square';
import { todayIso, type Env } from './env';

export const HOLD_MINUTES = 30;
/** 期限を過ぎても Square に確かめられないとき、押さえを続ける上限（分） */
const GIVE_UP_MINUTES = 120;
/** 部屋を戻したあとも支払いを見回る時間 */
const LATE_WATCH_HOURS = 24;
const MAIL_TRIES = 3;
const IP_PENDING_MAX = 2;
const IP_HOURLY_MAX = 6;
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
  /** 申込みの送り元IP（押さえすぎ対策。ハッシュにして残す） */
  clientIp?: string;
}

export type CheckoutResult =
  | { ok: true; no: string; key: string; url: string }
  | { ok: false; code: 'invalid' | 'unavailable' | 'payment_error' | 'busy'; message?: string };

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

async function hashIp(ip: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sayozuki-hp:' + ip));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ISO の時刻を D1 の created_at と同じ形（秒まで・Z）に */
const sqlTime = (d: Date) => d.toISOString().slice(0, 19) + 'Z';

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
  const ipHash = clip(input.clientIp, 64) ? await hashIp(clip(input.clientIp, 64)) : '';

  // 同じ人（同じメール・同じ送り元）が申し込み直したら、前の押さえを外す（戻って日程を変えたとき。払われていたら確定する）
  // メールだけで外すと、2部屋を続けて申し込んだときに1部屋目が消える・他人のメールで押さえを外せてしまうので、送り元もそろえる
  const prev = ipHash
    ? await env.DB.prepare("SELECT * FROM hp_checkouts WHERE status = 'pending' AND lower(email) = lower(?) AND ip_hash = ?")
        .bind(email, ipHash)
        .all<CheckoutRow>()
    : { results: [] as CheckoutRow[] };
  // 期限を「いま」にして settle に渡す。Square に聞けない・リンクを消せないときは外さない（払われた申込みを消さない）
  const justNow = new Date(now.getTime() - 1).toISOString();
  for (const r of prev.results ?? []) await settle(env, { ...r, expires_at: justNow }, now);
  // 同じ送り元からの押さえすぎを止める（空押さえで部屋を埋められないように）
  if (ipHash) {
    const c = await env.DB.prepare(
      `SELECT COALESCE(SUM(status = 'pending'), 0) AS pending, COUNT(*) AS recent FROM hp_checkouts WHERE ip_hash = ?1 AND created_at >= ?2`,
    )
      .bind(ipHash, sqlTime(new Date(now.getTime() - 3600_000)))
      .first<{ pending: number; recent: number }>();
    if (c && (Number(c.pending) >= IP_PENDING_MAX || Number(c.recent) >= IP_HOURLY_MAX)) {
      console.log('HP予約：同じ送り元からの申込みが多いので断った');
      return { ok: false, code: 'busy' };
    }
  }

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
    `INSERT INTO hp_checkouts (no, view_key, amount, email, lang, summary, expires_at, ip_hash)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8 WHERE EXISTS (SELECT 1 FROM bookings WHERE no = ?1 AND created_by = 'hp')`,
  ).bind(no, key, input.amount, email, clip(input.lang, 10) || 'ja', JSON.stringify(input.mail ?? {}), expires, ipHash);
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
  mail_tries: number;
  paid_at: string;
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

/** 毎分。決済待ちを Square に聞いて確定するか、期限切れなら部屋を戻す。送れなかった確認メールも送り直す */
export async function sweep(env: Env, now = new Date()) {
  const { results } = await env.DB.prepare("SELECT * FROM hp_checkouts WHERE status = 'pending' ORDER BY created_at LIMIT 25").all<CheckoutRow>();
  const out = { paid: 0, expired: 0, pending: 0, late: 0, mails: 0 };
  const touched = new Set<string>(); // この回に確定した（＝メールを送ろうとした）もの。同じ回に送り直さない
  for (const row of results) {
    const s = await settle(env, row, now);
    if (s === 'paid') touched.add(row.no);
    if (s === 'paid') out.paid++;
    else if (s === 'expired') out.expired++;
    else out.pending++;
  }
  // 部屋を戻したあとに払われていないか（5分ごと）
  if (now.getUTCMinutes() % 5 === 0) {
    const late = await env.DB.prepare(
      `SELECT * FROM hp_checkouts WHERE status = 'expired' AND order_id <> '' AND expires_at >= ? ORDER BY expires_at DESC LIMIT 10`,
    )
      .bind(new Date(now.getTime() - LATE_WATCH_HOURS * 3600_000).toISOString())
      .all<CheckoutRow>();
    for (const row of late.results ?? []) {
      try {
        if (await orderPaid(env, row.order_id)) {
          touched.add(row.no);
          await confirm(env, row);
          out.late++;
        }
      } catch (e) {
        console.error('期限切れの申込みの支払いを確かめられなかった', row.no, e);
      }
    }
  }
  // 送れなかった確認メール
  const unsent = await env.DB.prepare(
    `SELECT no FROM hp_checkouts WHERE status = 'paid' AND mailed = 0 AND mail_tries < ?1 AND paid_at >= ?2 LIMIT 10`,
  )
    .bind(MAIL_TRIES, sqlTime(new Date(now.getTime() - 86400_000)))
    .all<{ no: string }>();
  for (const r of unsent.results ?? []) {
    if (touched.has(r.no)) continue;
    await sendConfirmation(env, r.no);
    out.mails++;
  }
  return out;
}

/**
 * 決済待ち1件の行き先を決める。
 * 払われたか確かめられなかったとき・支払いリンクを消せなかったときは、払われた予約を消さないよう押さえたまま次の回に回す。
 * それが GIVE_UP_MINUTES 続いたら部屋を戻す（あとから払われても LATE_WATCH_HOURS のあいだは見回りで気づく）
 */
async function settle(env: Env, row: CheckoutRow, now: Date): Promise<CheckoutRow['status']> {
  let paid: boolean | null = false;
  if (row.order_id) {
    try {
      paid = await orderPaid(env, row.order_id);
    } catch (e) {
      console.error('支払いを確かめられなかった', row.no, e);
      paid = null;
    }
  }
  if (paid) {
    await confirm(env, row);
    return 'paid';
  }
  if (row.expires_at >= now.toISOString()) return 'pending';
  const giveUp = row.expires_at < new Date(now.getTime() - GIVE_UP_MINUTES * 60_000).toISOString();
  if (paid === null && !giveUp) return 'pending';
  const deleted = await deletePaymentLink(env, row.link_id);
  if (!deleted && !giveUp) return 'pending';
  await release(env, row.no, 'expired');
  return 'expired';
}

async function confirm(env: Env, row: CheckoutRow) {
  const [b, c] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE bookings SET status = '確定', payment = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE no = ?1 AND created_by = 'hp' AND status = '仮'`,
    ).bind(row.no, PAID_LABEL),
    env.DB.prepare(
      `UPDATE hp_checkouts SET status = 'paid', paid_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE no = ?1 AND status IN ('pending', 'expired')`,
    ).bind(row.no),
  ]);
  if (!c.meta.changes) return; // ほかの呼び出しが先に確定した
  if (!b.meta.changes) {
    // 押さえが外れたあとに払われた。返金か手での予約が要る（確認メールは送らない）
    await env.DB.prepare('UPDATE hp_checkouts SET mailed = 1 WHERE no = ?').bind(row.no).run();
    await log(env, 'HP予約：押さえの外れた予約に支払い', row.no, `${row.amount}円。返金するか、空いていれば手で予約を入れる`);
    await sendMail(env, innAddresses(env), `【小夜月】要対応：期限切れの予約 ${row.no} に支払いがありました`,
      `予約番号 ${row.no} は決済の期限が切れて部屋を戻したあとに、${row.amount.toLocaleString('ja-JP')}円が支払われました。\nお客様：${row.email}\nSquare で返金するか、空いていれば予約管理から手で入れてください。`);
    await notify(env, '小夜月 予約：要対応', `期限切れのHP予約 ${row.no} に ${row.amount.toLocaleString('ja-JP')}円の支払い。返金か手で予約を`);
    return;
  }
  await log(env, 'HP予約（決済済）', row.no, `${row.amount}円`);
  const bk = await env.DB.prepare('SELECT room, check_in, check_out, adults, name FROM bookings WHERE no = ?')
    .bind(row.no)
    .first<{ room: string; check_in: string; check_out: string; adults: string; name: string }>();
  await notify(
    env,
    '小夜月 予約：HP予約（決済済）',
    bk
      ? `${bk.room} ${md(bk.check_in)}〜${md(bk.check_out)} ${bk.adults}名 ${bk.name} ${row.amount.toLocaleString('ja-JP')}円`
      : `${row.no} ${row.amount.toLocaleString('ja-JP')}円`,
  );
  await sendConfirmation(env, row.no);
}

/**
 * 確認メール（お客様と宿）。送れたら mailed = 1。送れなければ mailed = 0 に戻し、毎分の見回りで送り直す。
 * MAIL_TRIES 回だめなら宿に知らせる（お客様へは宿から連絡する）
 */
async function sendConfirmation(env: Env, no: string) {
  const claim = await env.DB.prepare(
    'UPDATE hp_checkouts SET mailed = 2, mail_tries = mail_tries + 1 WHERE no = ? AND mailed = 0 AND mail_tries < ?',
  )
    .bind(no, MAIL_TRIES)
    .run();
  if (!claim.meta.changes) return;
  const row = await env.DB.prepare('SELECT * FROM hp_checkouts WHERE no = ?').bind(no).first<CheckoutRow>();
  if (!row) return;
  if (!mailConfigured(env)) {
    console.log(`[mail] 未設定のため確認メールを送らなかった：${no}`);
    await env.DB.prepare('UPDATE hp_checkouts SET mailed = 1 WHERE no = ?').bind(no).run();
    return;
  }
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
  const sent = mail.guestSubject && mail.guestBody && row.email ? await sendMail(env, row.email, mail.guestSubject, mail.guestBody, inn[0]) : true;
  if (sent) {
    if (mail.innSubject && mail.innBody) await sendMail(env, inn, mail.innSubject, mail.innBody, row.email || undefined);
    await env.DB.prepare('UPDATE hp_checkouts SET mailed = 1 WHERE no = ?').bind(no).run();
    return;
  }
  await env.DB.prepare('UPDATE hp_checkouts SET mailed = 0 WHERE no = ?').bind(no).run();
  if (row.mail_tries >= MAIL_TRIES) {
    await log(env, 'HP予約：確認メールを送れなかった', no, row.email);
    await notify(env, '小夜月 予約：要対応', `HP予約 ${no} の確認メールを${MAIL_TRIES}回送れなかった。${row.email} に宿から連絡を`);
    if (mail.innSubject && mail.innBody) {
      await sendMail(env, inn, '【要対応・お客様に確認メール未達】' + mail.innSubject, mail.innBody, row.email || undefined);
    }
  }
}

/** 押さえを外す。HPの仮の行を「キャンセル」にしてメモに理由を足す（行は消さない。申込みの記録として台帳に残す） */
async function release(env: Env, no: string, status: 'expired' | 'failed') {
  const why = releaseNote(status);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE bookings SET status = 'キャンセル', memo = CASE WHEN memo = '' THEN ?2 ELSE memo || char(10) || ?2 END,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE no = ?1 AND created_by = 'hp' AND status = '仮'`,
    ).bind(no, why),
    env.DB.prepare("UPDATE hp_checkouts SET status = ?2 WHERE no = ?1 AND status = 'pending'").bind(no, status),
  ]);
  await log(env, status === 'expired' ? 'HP予約（期限切れで取り消し）' : 'HP予約（決済の準備に失敗）', no, '');
}

/** 取り消したHP申込みのメモに足す1行（台帳のメモにも同じ文が入る） */
export function releaseNote(status: 'expired' | 'failed') {
  return status === 'expired' ? `HP申込み：${HOLD_MINUTES}分以内に決済されず取り消し` : 'HP申込み：決済の準備に失敗して取り消し';
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
