import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDb } from './d1.mjs';
import { startCheckout, sweep, type CheckoutInput } from '../src/hp';
import { syncFromSheet } from '../src/db';
import type { Env } from '../src/env';

// Square と Resend の代わり。fetch を差し替える
const sq = { paid: false, orderFails: false, deleteFails: false, mailFails: false, deleted: [] as string[], mails: 0 };
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = init?.method ?? 'GET';
  const j = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  if (url.includes('/v2/online-checkout/payment-links') && method === 'POST') {
    const no = JSON.parse(String(init?.body)).order.reference_id;
    return j({ payment_link: { id: 'link-' + no, url: 'https://pay/' + no, order_id: 'ord-' + no } });
  }
  if (url.includes('/v2/online-checkout/payment-links/') && method === 'DELETE') {
    if (sq.deleteFails) return j({ errors: [{ detail: 'down' }] }, 500);
    sq.deleted.push(url);
    return j({});
  }
  if (url.includes('/v2/orders/')) {
    if (sq.orderFails) return j({ errors: [{ detail: 'down' }] }, 503);
    return j({ order: sq.paid ? { state: 'COMPLETED' } : { state: 'OPEN' } });
  }
  if (url.includes('api.resend.com')) {
    sq.mails++;
    return sq.mailFails ? j({ message: 'x' }, 500) : j({ id: 'm' });
  }
  if (url.includes('push') || url.includes('googleapis')) return new Response('', { status: 201 });
  return realFetch(input, init);
});

const { db, dispose } = (await makeDb()) as { db: D1Database; dispose: () => Promise<void> };
afterAll(dispose);

const env = {
  DB: db,
  SQUARE_ACCESS_TOKEN: 't',
  SQUARE_LOCATION_ID: 'L',
  SQUARE_ENV: 'sandbox',
  RESEND_API_KEY: 'k',
  MAIL_FROM: 'inn@example.com',
  MAIL_TO: 'inn@example.com',
} as unknown as Env;

const T0 = new Date('2026-11-19T03:00:00Z'); // 日本時間 12:00
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  room: '201', checkIn: '2026-12-01', checkOut: '2026-12-02', guests: 2, name: 'テスト', email: 'a@example.com', tel: '090',
  arrival: '', meals: '', memo: '', lang: 'ja', lines: [{ name: '宿泊', quantity: 1, unitAmount: 10000 }], amount: 10000,
  returnUrl: 'https://sayozuki.com/reserve/done', mail: { guestSubject: 'g {no}', guestBody: 'b', innSubject: 'i', innBody: 'b' },
  clientIp: '1.2.3.4', ...over,
});

const status = async (no: string) =>
  db.prepare('SELECT h.status AS h, b.status AS b, h.mailed AS mailed, h.mail_tries AS tries FROM hp_checkouts h JOIN bookings b ON b.no = h.no WHERE h.no = ?')
    .bind(no).first<{ h: string; b: string; mailed: number; tries: number }>();
const pushes = async () => (await db.prepare('SELECT body FROM push_log ORDER BY id').all<{ body: string }>()).results.map((r) => r.body);

beforeEach(async () => {
  Object.assign(sq, { paid: false, orderFails: false, deleteFails: false, mailFails: false, deleted: [], mails: 0 });
  for (const t of ['bookings', 'hp_checkouts', 'rooms', 'push_log', 'op_log']) await db.prepare(`DELETE FROM ${t}`).run();
  await db.prepare("INSERT INTO rooms (name, capacity, state, sort) VALUES ('201', 4, '販売可', 0), ('301', 4, '販売可', 1), ('302', 2, '販売可', 2)").run();
});

async function hold(over: Partial<CheckoutInput> = {}, now = T0) {
  const r = await startCheckout(env, input(over), now);
  if (!r.ok) throw new Error('hold failed ' + r.code);
  return r.no;
}

describe('HPの決済待ちの見回り', () => {
  it('期限切れでも Square に聞けないあいだは部屋を押さえたまま。2時間たったら戻す', async () => {
    const no = await hold();
    sq.orderFails = true;
    await sweep(env, at(31));
    expect(await status(no)).toMatchObject({ h: 'pending', b: '仮' });
    await sweep(env, at(30 + 121));
    expect(await status(no)).toMatchObject({ h: 'expired', b: 'キャンセル' });
  });

  it('支払いリンクを消せないあいだは部屋を戻さない', async () => {
    const no = await hold();
    sq.deleteFails = true;
    await sweep(env, at(31));
    expect(await status(no)).toMatchObject({ h: 'pending', b: '仮' });
    sq.deleteFails = false;
    await sweep(env, at(32));
    expect(await status(no)).toMatchObject({ h: 'expired', b: 'キャンセル' });
  });

  it('部屋を戻したあとに払われたら、見回りで気づいて宿に知らせる（予約は戻さない）', async () => {
    const no = await hold();
    await sweep(env, at(31));
    sq.paid = true;
    await sweep(env, at(35)); // 5分ごとの見回り
    expect(await status(no)).toMatchObject({ h: 'paid', b: 'キャンセル', mailed: 1 });
    expect((await pushes()).some((p) => p.includes('期限切れのHP予約') && p.includes(no))).toBe(true);
    expect(sq.mails).toBe(1); // 宿への要対応メールだけ
  });

  it('確認メールが送れなければ送り直し、3回だめなら宿に知らせる', async () => {
    const no = await hold();
    sq.paid = true;
    sq.mailFails = true;
    await sweep(env, at(1));
    expect(await status(no)).toMatchObject({ h: 'paid', b: '確定', mailed: 0, tries: 1 });
    await sweep(env, at(2));
    await sweep(env, at(3));
    expect(await status(no)).toMatchObject({ mailed: 0, tries: 3 });
    expect((await pushes()).some((p) => p.includes('確認メール'))).toBe(true);
    await sweep(env, at(4));
    expect((await status(no))!.tries).toBe(3);
  });

  it('確認メールが送れたら1回だけ', async () => {
    const no = await hold();
    sq.paid = true;
    await sweep(env, at(1));
    await sweep(env, at(2));
    expect(await status(no)).toMatchObject({ mailed: 1, tries: 1 });
    expect(sq.mails).toBe(2); // お客様と宿
  });
});

describe('押さえすぎ対策', () => {
  it('同じメールで申し込み直すと、前の押さえを外す', async () => {
    const a = await hold();
    const b = await hold({ room: '301' }, at(1));
    expect(await status(a)).toMatchObject({ h: 'expired', b: 'キャンセル' });
    expect(await status(b)).toMatchObject({ h: 'pending', b: '仮' });
  });

  it('同じメールでも送り元が違えば外さない（2部屋を別々に申し込んだとき・他人のメール）', async () => {
    const a = await hold();
    await hold({ room: '301', clientIp: '5.6.7.8' }, at(1));
    expect(await status(a)).toMatchObject({ h: 'pending', b: '仮' });
  });

  it('前の押さえが払われていたら確定にする（外さない）', async () => {
    const a = await hold();
    sq.paid = true;
    await hold({ room: '301' }, at(1));
    expect(await status(a)).toMatchObject({ h: 'paid', b: '確定' });
  });

  it('同じ送り元の決済待ちは2件まで', async () => {
    await hold({ email: 'x1@example.com', room: '201' });
    await hold({ email: 'x2@example.com', room: '301' });
    const r = await startCheckout(env, input({ email: 'x3@example.com', room: '302' }), at(1));
    expect(r).toEqual({ ok: false, code: 'busy' });
    const other = await startCheckout(env, input({ email: 'x3@example.com', room: '302', clientIp: '5.6.7.8' }), at(1));
    expect(other.ok).toBe(true);
  });
});

describe('台帳との同期', () => {
  const room = { name: '201', capacity: 4, state: '販売可' };
  const row = (no: string, over: Record<string, string> = {}) => ({ no, channel: 'Airbnb', status: '確定', room: '201', checkIn: '2026-12-01', checkOut: '2026-12-02', name: 'A', ...over });

  it('変わった行だけ書き、消えた行は消し、アプリの未反映の予約は残す', async () => {
    await db.prepare("INSERT INTO bookings (no, source, in_sheet, status, room, check_in, check_out) VALUES ('SZ-APP', 'app', 0, '確定', '301', '2026-12-05', '2026-12-06')").run();
    await syncFromSheet(env, { rooms: [room], bookings: [row('A1'), row('A2'), { room: '201', checkIn: '2026-12-09', checkOut: '2026-12-10', name: '番号なし' }] });
    const before = await db.prepare("SELECT no, updated_at FROM bookings WHERE no = 'A1'").first<{ updated_at: string }>();
    await db.prepare("UPDATE bookings SET updated_at = 'old' WHERE no IN ('A1', 'A2')").run();

    await syncFromSheet(env, { rooms: [room], bookings: [row('A1'), row('A2', { name: 'B' }), row('SZ-APP', { room: '301' }), { room: '201', checkIn: '2026-12-09', checkOut: '2026-12-10', name: '番号なし' }] });
    const all = (await db.prepare('SELECT no, name, updated_at, in_sheet FROM bookings ORDER BY no').all<Record<string, string>>()).results;
    expect(before).toBeTruthy();
    expect(all.find((r) => r.no === 'A1')!.updated_at).toBe('old'); // 変わっていないので書かない
    expect(all.find((r) => r.no === 'A2')).toMatchObject({ name: 'B' });
    expect(all.find((r) => r.no === 'A2')!.updated_at).not.toBe('old');
    expect(all.find((r) => r.no === 'SZ-APP')).toMatchObject({ in_sheet: 1 });
    expect(all.filter((r) => r.no === null)).toHaveLength(1); // 番号なしは入れ直して1行のまま

    await syncFromSheet(env, { rooms: [room], bookings: [row('A1'), row('SZ-APP', { room: '301' })] });
    const left = (await db.prepare('SELECT no FROM bookings ORDER BY no').all<{ no: string }>()).results.map((r) => r.no);
    expect(left).toEqual(['A1', 'SZ-APP']);
  });
});
