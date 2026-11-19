import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDb } from './d1.mjs';
import { handleStaff } from '../src/routes/staff';
import { handleGuest } from '../src/routes/guest';
import { resetDepartedRooms, resetKey } from '../src/lib/reset';
import { heldCounts } from '../src/square/admin';
import type { Env } from '../src/env';

vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));

const { db, dispose } = (await makeDb()) as { db: D1Database; dispose: () => Promise<void> };
afterAll(dispose);

const booking = { departed: ['201'], occupied: ['302'] };
const env = {
  DB: db,
  STAFF_PIN: 'correct-pin-1234',
  MOCK_SQUARE: '1',
  BOOKING: {
    occupied: async () => ({ night: '', rooms: booking.occupied }),
    departed: async (date: string) => ({ date, rooms: booking.departed })
  },
  DESK: { idFromName: () => 'x', get: () => ({ purgeMenu: async () => {} }) }
} as unknown as Env;
const ctx = { waitUntil: (p: Promise<unknown>) => p.catch(() => {}), passThroughOnException() {} } as unknown as ExecutionContext;

const staff = (path: string, pin: string, ip = '9.9.9.9', method = 'GET') => {
  const url = new URL('https://order.sayozuki.com/staff/api' + path);
  return handleStaff(new Request(url, { method, headers: { authorization: 'Bearer ' + pin, 'cf-connecting-ip': ip } }), env, url, ctx).then(
    (r) => r.status,
    (e) => e.status as number
  );
};

const ROOM_A = 'room_aaaaaaaaaaaaaaaa';
const ROOM_B = 'room_bbbbbbbbbbbbbbbb';

beforeEach(async () => {
  for (const t of ['order_lines', 'orders', 'settlements', 'requests', 'messages', 'settings', 'rooms']) await db.prepare(`DELETE FROM ${t}`).run();
  await db.prepare("INSERT INTO rooms (id, name, sort, dnd, created_at) VALUES (?1, '201号室', 0, 1, '2026-01-01'), (?2, '302号室', 1, 1, '2026-01-01')").bind(ROOM_A, ROOM_B).run();
  for (const id of [ROOM_A, ROOM_B]) {
    await db.prepare("INSERT INTO messages (id, room_id, sender, body, lang, created_at) VALUES (?, ?, 'guest', 'hi', 'en', '2026-11-18T10:00:00Z')").bind('m' + id, id).run();
    await db.prepare("INSERT INTO requests (id, room_id, kind, status, created_at) VALUES (?, ?, 'tea', 'new', '2026-11-18T10:00:00Z')").bind('q' + id, id).run();
  }
});

describe('スタッフ画面のPIN', () => {
  it('10回間違えたらその送り元は正しいPINでも止める。ほかの送り元は通す', async () => {
    for (let i = 0; i < 10; i++) expect(await staff('/ping', 'wrong')).toBe(401);
    expect(await staff('/ping', 'wrong')).toBe(429);
    expect(await staff('/ping', 'correct-pin-1234')).toBe(429);
    expect(await staff('/ping', 'correct-pin-1234', '8.8.8.8')).toBe(200);
  });
  it('正しいPINで入れば間違いの数は消える', async () => {
    for (let i = 0; i < 5; i++) await staff('/ping', 'wrong');
    expect(await staff('/ping', 'correct-pin-1234')).toBe(200);
    const left = await db.prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'pinfail:%'").first<{ n: number }>();
    expect(left!.n).toBe(0);
  });
});

describe('チェックアウトした部屋の片付け', () => {
  const jst = (hhmm: string) => new Date(`2026-11-19T${hhmm}:00+09:00`);
  const roomState = async (id: string) => ({
    dnd: (await db.prepare('SELECT dnd FROM rooms WHERE id = ?').bind(id).first<{ dnd: number }>())!.dnd,
    open: (await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE room_id = ? AND closed = 0').bind(id).first<{ n: number }>())!.n,
    reqs: (await db.prepare("SELECT COUNT(*) AS n FROM requests WHERE room_id = ? AND status = 'new'").bind(id).first<{ n: number }>())!.n
  });

  it('11時前は何もしない。11時を過ぎたら出た部屋だけ片付け、1日1回だけ', async () => {
    expect(await resetDepartedRooms(env, jst('10:59'))).toBeNull();
    expect(await roomState(ROOM_A)).toEqual({ dnd: 1, open: 1, reqs: 1 });
    expect(await resetDepartedRooms(env, jst('11:00'))).toEqual({ date: '2026-11-19', reset: ['201号室'] });
    expect(await roomState(ROOM_A)).toEqual({ dnd: 0, open: 0, reqs: 0 });
    expect(await roomState(ROOM_B)).toEqual({ dnd: 1, open: 1, reqs: 1 });
    expect(await resetDepartedRooms(env, jst('11:01'))).toBeNull();
  });

  it('精算が残っていたらスタッフに知らせる', async () => {
    await db.prepare("INSERT INTO orders (id, room_id, delivery, status, total, created_at) VALUES ('o1', ?, 'door', 'delivered', 1500, '2026-11-18T12:00:00Z')").bind(ROOM_A).run();
    await resetDepartedRooms(env, jst('11:00'));
    const latest = await db.prepare("SELECT value FROM settings WHERE key = 'latest'").first<{ value: string }>();
    expect(JSON.parse(latest!.value).text).toContain('201号室 はチェックアウト済みですが、精算が ¥1,500');
  });

  it('片付けより前の精算の領収書は次のお客様に見せない', async () => {
    const receipt = async () => {
      const url = new URL('https://order.sayozuki.com/api/receipt');
      return handleGuest(new Request(url, { headers: { 'x-room': ROOM_A } }), env, url, ctx).then((r) => r.status, (e) => e.status);
    };
    const recent = new Date(Date.now() - 3600e3).toISOString();
    await db.prepare("INSERT INTO settlements (id, room_id, status, total, created_at, settled_at) VALUES ('s1', ?, 'settled', 1000, ?, ?)").bind(ROOM_A, recent, recent).run();
    expect(await receipt()).toBe(200);
    await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(resetKey(ROOM_A), new Date().toISOString()).run();
    expect(await receipt()).toBe(409);
  });
});

describe('在庫の押さえ', () => {
  it('今日の注文だけ数える（前日の未精算で今日の数を減らさない）', async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 36 * 3600e3).toISOString();
    for (const [id, at] of [['o-today', today], ['o-old', yesterday]] as const) {
      await db.prepare("INSERT INTO orders (id, room_id, delivery, status, total, created_at) VALUES (?, ?, 'door', 'new', 3000, ?)").bind(id, ROOM_A, at).run();
      await db.prepare("INSERT INTO order_lines (order_id, variation_id, name, unit_price, qty, tracked) VALUES (?, 'V1', 'すき焼き', 3000, 1, 1)").bind(id).run();
    }
    expect(await heldCounts(env)).toEqual({ V1: 1 });
  });
});
