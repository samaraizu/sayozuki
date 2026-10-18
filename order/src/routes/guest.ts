import type { Env } from '../env';
import { isMock } from '../env';
import { REQUEST_KINDS } from '../config/requests';
import { notifyStaff } from '../lib/notify';
import { nowIso } from '../lib/time';
import { HttpError, json, newId, readJson } from '../lib/util';
import type { OrderDesk } from '../desk';

export interface RoomRow {
  id: string;
  name: string;
  sort: number;
  dnd: number;
  created_at: string;
}

export interface SettlementRow {
  id: string;
  room_id: string;
  status: 'pending' | 'settled' | 'canceled';
  total: number;
  square_order_id: string | null;
  payment_link_id: string | null;
  payment_url: string | null;
  method: string | null;
  created_at: string;
  settled_at: string | null;
}

export const desk = (env: Env) => env.DESK.get(env.DESK.idFromName('main')) as unknown as DurableObjectStub<OrderDesk>;

/** 客室QRの固定URL（?r=ランダムid）から部屋を引く。ログインはしない */
async function roomFromHeader(req: Request, env: Env) {
  const id = req.headers.get('x-room') ?? '';
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(id)) throw new HttpError(401, 'no_room');
  const room = await env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<RoomRow>();
  if (!room) throw new HttpError(401, 'invalid_room');
  return room;
}

export const pendingSettlement = (env: Env, roomId: string) =>
  env.DB.prepare("SELECT * FROM settlements WHERE room_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(roomId).first<SettlementRow>();

async function linesFor(env: Env, orderIds: string[]) {
  if (!orderIds.length) return new Map<string, any[]>();
  const r = await env.DB.prepare(`SELECT order_id, variation_id, name, unit_price, qty FROM order_lines WHERE order_id IN (${orderIds.map(() => '?').join(',')})`)
    .bind(...orderIds)
    .all<any>();
  const map = new Map<string, any[]>();
  for (const l of r.results ?? []) {
    const arr = map.get(l.order_id) ?? [];
    arr.push({ variationId: l.variation_id, name: l.name, price: l.unit_price, qty: l.qty });
    map.set(l.order_id, arr);
  }
  return map;
}

/** 部屋のいまのお会計：未精算の注文＋お支払い待ちの精算 */
export async function roomBill(env: Env, roomId: string) {
  const pending = await pendingSettlement(env, roomId);
  const orders = await env.DB.prepare(
    `SELECT id, delivery, status, total, created_at, delivered_at, settlement_id FROM orders
      WHERE room_id = ? AND (settlement_id IS NULL ${pending ? 'OR settlement_id = ?' : ''})
      ORDER BY created_at`
  )
    .bind(...(pending ? [roomId, pending.id] : [roomId]))
    .all<any>();
  const list = orders.results ?? [];
  const lines = await linesFor(env, list.map((o) => o.id));
  const withLines = list.map((o) => ({ ...o, lines: lines.get(o.id) ?? [] }));
  const live = withLines.filter((o) => o.status !== 'canceled');
  return {
    orders: withLines,
    unsettledTotal: live.filter((o) => !o.settlement_id).reduce((a, o) => a + o.total, 0),
    total: live.reduce((a, o) => a + o.total, 0),
    payUrl: pending?.payment_url ?? null,
    pendingTotal: pending?.total ?? 0
  };
}

export async function settlementLines(env: Env, settlementId: string) {
  const orders = await env.DB.prepare("SELECT id FROM orders WHERE settlement_id = ? AND status != 'canceled'").bind(settlementId).all<{ id: string }>();
  const map = await linesFor(env, (orders.results ?? []).map((o) => o.id));
  return [...map.values()].flat();
}

export async function handleGuest(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = req.method;

  if (path === '/api/session' && method === 'GET') {
    const room = await roomFromHeader(req, env);
    const reqs = await env.DB.prepare("SELECT kind FROM requests WHERE room_id = ? AND status = 'new'").bind(room.id).all<{ kind: string }>();
    const pending = await pendingSettlement(env, room.id);
    return json({
      room: room.name,
      dnd: Boolean(room.dnd),
      payUrl: pending?.payment_url ?? null,
      requested: (reqs.results ?? []).map((r) => r.kind),
      guideBase: env.GUIDE_BASE_URL,
      lastOrder: env.LAST_ORDER
    });
  }

  if (path === '/api/menu' && method === 'GET') {
    await roomFromHeader(req, env);
    return json(await desk(env).guestMenu());
  }

  if (path === '/api/orders' && method === 'POST') {
    const room = await roomFromHeader(req, env);
    const body = await readJson<{ lines: { id: string; qty: number }[]; delivery: 'door' | 'hand' }>(req);
    const r = await desk(env).placeOrder({ roomId: room.id, lines: Array.isArray(body.lines) ? body.lines.slice(0, 30) : [], delivery: body.delivery });
    if (!r.ok) return json({ error: r.code, detail: r.detail }, r.status);
    await notifyStaff(env, `🛎 ${r.room} 注文 ${r.lines.map((l) => `${l.name}×${l.qty}`).join('、')}（${body.delivery === 'hand' ? '手渡し' : '扉前'}）`);
    return json({ id: r.id, total: r.total });
  }

  if (path === '/api/orders' && method === 'GET') {
    const room = await roomFromHeader(req, env);
    return json(await roomBill(env, room.id));
  }

  if (path === '/api/requests' && method === 'POST') {
    const room = await roomFromHeader(req, env);
    const { kind } = await readJson<{ kind: string }>(req);
    if (!REQUEST_KINDS[kind]) throw new HttpError(400, 'bad_kind');
    const dup = await env.DB.prepare("SELECT id FROM requests WHERE room_id = ? AND kind = ? AND status = 'new'").bind(room.id, kind).first();
    if (!dup) {
      await env.DB.prepare('INSERT INTO requests (id, room_id, kind, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(newId('req'), room.id, kind, 'new', nowIso())
        .run();
      await notifyStaff(env, `🫖 ${room.name} リクエスト：${REQUEST_KINDS[kind]}`);
    }
    return json({ ok: true });
  }

  if (path === '/api/dnd' && method === 'POST') {
    const room = await roomFromHeader(req, env);
    const { on } = await readJson<{ on: boolean }>(req);
    await env.DB.prepare('UPDATE rooms SET dnd = ? WHERE id = ?').bind(on ? 1 : 0, room.id).run();
    return json({ ok: true });
  }

  // 直近（48時間以内）に支払いが済んだ精算の領収書
  if (path === '/api/receipt' && method === 'GET') {
    const room = await roomFromHeader(req, env);
    const s = await env.DB.prepare(
      "SELECT * FROM settlements WHERE room_id = ? AND status = 'settled' AND settled_at >= ? ORDER BY settled_at DESC LIMIT 1"
    )
      .bind(room.id, new Date(Date.now() - 48 * 3600e3).toISOString())
      .first<SettlementRow>();
    if (!s) throw new HttpError(409, 'not_settled');
    return json({
      room: room.name,
      settledAt: s.settled_at,
      total: s.total,
      lines: await settlementLines(env, s.id),
      company: { name: env.COMPANY_NAME, address: env.COMPANY_ADDRESS, tel: env.COMPANY_TEL }
    });
  }

  if (path === '/api/mock/pay' && method === 'POST' && isMock(env)) {
    const room = await roomFromHeader(req, env);
    await env.DB.prepare("UPDATE settlements SET status = 'settled', method = 'square', settled_at = ? WHERE room_id = ? AND status = 'pending'")
      .bind(nowIso(), room.id)
      .run();
    return json({ ok: true });
  }

  throw new HttpError(404, 'not_found');
}
