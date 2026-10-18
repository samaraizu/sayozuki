import type { Env } from '../env';
import { isMock } from '../env';
import { REQUEST_KINDS } from '../config/requests';
import { bathTaxAmount } from '../lib/bathtax';
import { notifyStaff } from '../lib/notify';
import { nowIso } from '../lib/time';
import { HttpError, json, newId, readJson } from '../lib/util';
import type { OrderDesk } from '../desk';

export interface StayRow {
  id: string;
  token: string;
  room: string;
  guests_taxable: number;
  guests_exempt: number;
  nights: number;
  checkin_date: string;
  status: 'active' | 'checkout_pending' | 'settled';
  dnd: number;
  square_order_id: string | null;
  payment_link_id: string | null;
  payment_url: string | null;
  settled_method: string | null;
  bath_tax_yen: number | null;
  created_at: string;
  settled_at: string | null;
}

export const desk = (env: Env) => env.DESK.get(env.DESK.idFromName('main')) as unknown as DurableObjectStub<OrderDesk>;

async function stayFromToken(req: Request, env: Env, allowSettled = false) {
  const token = req.headers.get('x-stay-token') ?? '';
  if (token.length < 16) throw new HttpError(401, 'no_token');
  const stay = await env.DB.prepare('SELECT * FROM stays WHERE token = ?').bind(token).first<StayRow>();
  if (!stay) throw new HttpError(401, 'invalid_token');
  if (stay.status === 'settled' && !allowSettled) throw new HttpError(410, 'stay_settled');
  return stay;
}

export async function stayBill(env: Env, stay: StayRow) {
  const orders = await env.DB.prepare('SELECT id, delivery, status, total, created_at, delivered_at FROM orders WHERE stay_id = ? ORDER BY created_at').bind(stay.id).all<any>();
  const ids = (orders.results ?? []).map((o) => o.id);
  const lines = ids.length
    ? await env.DB.prepare(`SELECT order_id, variation_id, name, unit_price, qty FROM order_lines WHERE order_id IN (${ids.map(() => '?').join(',')})`)
        .bind(...ids)
        .all<any>()
    : { results: [] as any[] };
  const byOrder = new Map<string, any[]>();
  for (const l of lines.results ?? []) {
    const arr = byOrder.get(l.order_id) ?? [];
    arr.push({ variationId: l.variation_id, name: l.name, price: l.unit_price, qty: l.qty });
    byOrder.set(l.order_id, arr);
  }
  const list = (orders.results ?? []).map((o) => ({ ...o, lines: byOrder.get(o.id) ?? [] }));
  const subtotal = list.filter((o) => o.status !== 'canceled').reduce((a, o) => a + o.total, 0);
  const rate = Number(env.BATH_TAX_YEN);
  const bathTax = stay.bath_tax_yen ?? bathTaxAmount(stay.guests_taxable, stay.nights, rate);
  return { orders: list, subtotal, bathTax, total: subtotal + bathTax };
}

export async function handleGuest(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = req.method;

  if (path === '/api/session' && method === 'GET') {
    const stay = await stayFromToken(req, env, true);
    const reqs = await env.DB.prepare('SELECT kind, status FROM requests WHERE stay_id = ?').bind(stay.id).all<{ kind: string; status: string }>();
    return json({
      room: stay.room,
      status: stay.status,
      dnd: Boolean(stay.dnd),
      payUrl: stay.status === 'checkout_pending' ? stay.payment_url : null,
      bathTax: { taxable: stay.guests_taxable, nights: stay.nights, rate: Number(env.BATH_TAX_YEN) },
      requested: (reqs.results ?? []).map((r) => r.kind),
      guideBase: env.GUIDE_BASE_URL,
      lastOrder: env.LAST_ORDER
    });
  }

  if (path === '/api/menu' && method === 'GET') {
    await stayFromToken(req, env, true);
    return json(await desk(env).guestMenu());
  }

  if (path === '/api/orders' && method === 'POST') {
    const stay = await stayFromToken(req, env);
    const body = await readJson<{ lines: { id: string; qty: number }[]; delivery: 'door' | 'hand' }>(req);
    const r = await desk(env).placeOrder({ stayId: stay.id, lines: Array.isArray(body.lines) ? body.lines.slice(0, 30) : [], delivery: body.delivery });
    if (!r.ok) return json({ error: r.code, detail: r.detail }, r.status);
    const text = `🛎 ${r.room}号室 注文 ${r.lines.map((l) => `${l.name}×${l.qty}`).join('、')}（${body.delivery === 'hand' ? '手渡し' : '扉前'}）`;
    await notifyStaff(env, text);
    return json({ id: r.id, total: r.total });
  }

  if (path === '/api/orders' && method === 'GET') {
    const stay = await stayFromToken(req, env, true);
    return json(await stayBill(env, stay));
  }

  if (path === '/api/requests' && method === 'POST') {
    const stay = await stayFromToken(req, env);
    const { kind } = await readJson<{ kind: string }>(req);
    if (!REQUEST_KINDS[kind]) throw new HttpError(400, 'bad_kind');
    const dup = await env.DB.prepare("SELECT id FROM requests WHERE stay_id = ? AND kind = ? AND status = 'new'").bind(stay.id, kind).first();
    if (!dup) {
      await env.DB.prepare('INSERT INTO requests (id, stay_id, kind, status, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(newId('req'), stay.id, kind, 'new', nowIso())
        .run();
      await notifyStaff(env, `🫖 ${stay.room}号室 リクエスト：${REQUEST_KINDS[kind]}`);
    }
    return json({ ok: true });
  }

  if (path === '/api/dnd' && method === 'POST') {
    const stay = await stayFromToken(req, env);
    const { on } = await readJson<{ on: boolean }>(req);
    await env.DB.prepare('UPDATE stays SET dnd = ? WHERE id = ?').bind(on ? 1 : 0, stay.id).run();
    return json({ ok: true });
  }

  if (path === '/api/receipt' && method === 'GET') {
    const stay = await stayFromToken(req, env, true);
    if (stay.status !== 'settled') throw new HttpError(409, 'not_settled');
    const bill = await stayBill(env, stay);
    return json({
      room: stay.room,
      settledAt: stay.settled_at,
      ...bill,
      company: { name: env.COMPANY_NAME, address: env.COMPANY_ADDRESS, tel: env.COMPANY_TEL }
    });
  }

  if (path === '/api/mock/pay' && method === 'POST' && isMock(env)) {
    const stay = await stayFromToken(req, env, true);
    await env.DB.prepare("UPDATE stays SET status = 'settled', settled_method = 'square', settled_at = ? WHERE id = ? AND status = 'checkout_pending'")
      .bind(nowIso(), stay.id)
      .run();
    return json({ ok: true });
  }

  throw new HttpError(404, 'not_found');
}
