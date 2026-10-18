import type { Env } from '../env';
import { isMock } from '../env';
import { REQUEST_KINDS } from '../config/requests';
import { nowIso } from '../lib/time';
import { HttpError, json, newId, timingSafeEqual } from '../lib/util';
import { createCheckoutLink, deletePaymentLink } from '../square/checkout';
import { desk, pendingSettlement, roomBill, type RoomRow } from './guest';

function authStaff(req: Request, env: Env) {
  const pin = env.STAFF_PIN;
  if (!pin) throw new HttpError(503, 'staff_pin_not_set');
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!got || !timingSafeEqual(got, pin)) throw new HttpError(401, 'unauthorized');
}

/** 客室QRと支払い後の戻り先は、スタッフ画面を開いているドメインに合わせる */
const origin = (url: URL) => url.origin;
const roomUrl = (url: URL, id: string) => `${origin(url)}/?r=${id}`;

async function getRoom(env: Env, id: string) {
  const r = await env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<RoomRow>();
  if (!r) throw new HttpError(404, 'room_not_found');
  return r;
}

export async function handleStaff(req: Request, env: Env, url: URL): Promise<Response> {
  authStaff(req, env);
  const p = url.pathname.replace(/^\/staff\/api/, '');
  const m = req.method;
  let mt: RegExpMatchArray | null;

  if (p === '/ping') return json({ ok: true, mock: isMock(env), env: env.SQUARE_ENV });

  // 現場の一覧
  if (p === '/board' && m === 'GET') {
    const rooms = await env.DB.prepare('SELECT * FROM rooms ORDER BY sort, name').all<RoomRow>();
    const list = [];
    for (const r of rooms.results ?? []) {
      const bill = await roomBill(env, r.id);
      list.push({
        id: r.id,
        name: r.name,
        dnd: Boolean(r.dnd),
        unsettled: bill.unsettledTotal,
        pendingTotal: bill.pendingTotal,
        payUrl: bill.payUrl,
        url: roomUrl(url, r.id)
      });
    }
    const orders = await env.DB.prepare(
      `SELECT o.id, o.delivery, o.status, o.total, o.created_at, r.name AS room
         FROM orders o JOIN rooms r ON r.id = o.room_id
        WHERE o.status = 'new' ORDER BY o.created_at`
    ).all<any>();
    const ids = (orders.results ?? []).map((o) => o.id);
    const lines = ids.length
      ? await env.DB.prepare(`SELECT order_id, name, qty FROM order_lines WHERE order_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<any>()
      : { results: [] as any[] };
    const reqs = await env.DB.prepare(
      `SELECT q.id, q.kind, q.created_at, r.name AS room FROM requests q JOIN rooms r ON r.id = q.room_id WHERE q.status = 'new' ORDER BY q.created_at`
    ).all<any>();
    return json({
      rooms: list,
      orders: (orders.results ?? []).map((o) => ({ ...o, lines: (lines.results ?? []).filter((l) => l.order_id === o.id) })),
      requests: (reqs.results ?? []).map((r) => ({ ...r, label: REQUEST_KINDS[r.kind] ?? r.kind })),
      mock: isMock(env)
    });
  }

  if ((mt = p.match(/^\/orders\/([\w-]+)\/(deliver|cancel)$/)) && m === 'POST') {
    const [, id, action] = mt;
    if (action === 'deliver') {
      await env.DB.prepare("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ? AND status = 'new'").bind(nowIso(), id).run();
    } else {
      const o = await env.DB.prepare('SELECT settlement_id FROM orders WHERE id = ?').bind(id).first<{ settlement_id: string | null }>();
      if (!o) throw new HttpError(404, 'order_not_found');
      if (o.settlement_id) throw new HttpError(409, 'order_in_settlement');
      await env.DB.prepare("UPDATE orders SET status = 'canceled' WHERE id = ? AND status != 'canceled'").bind(id).run();
    }
    return json({ ok: true });
  }

  if ((mt = p.match(/^\/requests\/([\w-]+)\/done$/)) && m === 'POST') {
    await env.DB.prepare("UPDATE requests SET status = 'done', done_at = ? WHERE id = ?").bind(nowIso(), mt[1]).run();
    return json({ ok: true });
  }

  // 精算：その部屋の未精算の注文をまとめて、Squareの支払いリンクを発行
  if ((mt = p.match(/^\/rooms\/([\w-]+)\/checkout$/)) && m === 'POST') {
    const room = await getRoom(env, mt[1]);
    const existing = await pendingSettlement(env, room.id);
    if (existing) return json({ payUrl: existing.payment_url, total: existing.total });
    const bill = await roomBill(env, room.id);
    const targets = bill.orders.filter((o) => !o.settlement_id && o.status !== 'canceled');
    const total = targets.reduce((a, o) => a + o.total, 0);
    if (!targets.length || total === 0) throw new HttpError(409, 'nothing_to_settle');
    const agg = new Map<string, number>();
    for (const o of targets) for (const l of o.lines) agg.set(l.variationId, (agg.get(l.variationId) ?? 0) + l.qty);
    const sid = newId('stl');
    let link: { id: string | null; url: string; orderId: string | null };
    if (isMock(env)) {
      link = { id: null, url: `${origin(url)}/mock-pay#r=${room.id}`, orderId: null };
    } else {
      link = await createCheckoutLink(env, {
        refId: sid,
        room: room.name,
        lines: [...agg].map(([variation_id, qty]) => ({ variation_id, qty })),
        redirectUrl: `${roomUrl(url, room.id)}&paid=1`
      });
    }
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO settlements (id, room_id, status, total, square_order_id, payment_link_id, payment_url, created_at) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)"
      ).bind(sid, room.id, total, link.orderId, link.id, link.url, nowIso()),
      env.DB.prepare(`UPDATE orders SET settlement_id = ? WHERE id IN (${targets.map(() => '?').join(',')})`).bind(sid, ...targets.map((o) => o.id))
    ]);
    return json({ payUrl: link.url, total });
  }

  // 精算をやめる（注文を未精算に戻す）
  if ((mt = p.match(/^\/rooms\/([\w-]+)\/reopen$/)) && m === 'POST') {
    const room = await getRoom(env, mt[1]);
    const s = await pendingSettlement(env, room.id);
    if (!s) throw new HttpError(409, 'not_pending');
    if (s.payment_link_id && !isMock(env)) await deletePaymentLink(env, s.payment_link_id);
    await env.DB.batch([
      env.DB.prepare("UPDATE settlements SET status = 'canceled' WHERE id = ?").bind(s.id),
      env.DB.prepare('UPDATE orders SET settlement_id = NULL WHERE settlement_id = ?').bind(s.id)
    ]);
    return json({ ok: true });
  }

  // 現金などで受け取ったとき：お支払い待ちがあればそれを、なければ未精算をまとめて精算済みにする
  if ((mt = p.match(/^\/rooms\/([\w-]+)\/settle$/)) && m === 'POST') {
    const room = await getRoom(env, mt[1]);
    const s = await pendingSettlement(env, room.id);
    if (s) {
      if (s.payment_link_id && !isMock(env)) await deletePaymentLink(env, s.payment_link_id);
      await env.DB.prepare("UPDATE settlements SET status = 'settled', method = 'manual', settled_at = ? WHERE id = ?").bind(nowIso(), s.id).run();
    } else {
      const bill = await roomBill(env, room.id);
      const targets = bill.orders.filter((o) => !o.settlement_id && o.status !== 'canceled');
      if (!targets.length) throw new HttpError(409, 'nothing_to_settle');
      const sid = newId('stl');
      await env.DB.batch([
        env.DB.prepare("INSERT INTO settlements (id, room_id, status, total, method, created_at, settled_at) VALUES (?, ?, 'settled', ?, 'manual', ?, ?)").bind(
          sid,
          room.id,
          targets.reduce((a, o) => a + o.total, 0),
          nowIso(),
          nowIso()
        ),
        env.DB.prepare(`UPDATE orders SET settlement_id = ? WHERE id IN (${targets.map(() => '?').join(',')})`).bind(sid, ...targets.map((o) => o.id))
      ]);
    }
    await env.DB.prepare('UPDATE rooms SET dnd = 0 WHERE id = ?').bind(room.id).run();
    await desk(env).purgeMenu();
    return json({ ok: true });
  }

  if (p === '/menu/refresh' && m === 'POST') {
    await desk(env).purgeMenu();
    return json({ ok: true });
  }

  throw new HttpError(404, 'not_found');
}
