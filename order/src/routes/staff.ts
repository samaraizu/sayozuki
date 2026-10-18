import type { Env } from '../env';
import { isMock } from '../env';
import { REQUEST_KINDS } from '../config/requests';
import { bathTaxAmount, buildLedger, ledgerCsv } from '../lib/bathtax';
import { jstParts, nowIso } from '../lib/time';
import { HttpError, json, newId, randomToken, readJson, timingSafeEqual } from '../lib/util';
import { createCheckoutLink, deletePaymentLink } from '../square/checkout';
import { desk, stayBill, type StayRow } from './guest';

function authStaff(req: Request, env: Env) {
  const pin = env.STAFF_PIN;
  if (!pin) throw new HttpError(503, 'staff_pin_not_set');
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!got || !timingSafeEqual(got, pin)) throw new HttpError(401, 'unauthorized');
}

/** 客室QRと支払い後の戻り先は、スタッフ画面を開いているドメインに合わせる（独自ドメイン接続前のworkers.devでも正しく動くように） */
const origin = (_env: Env, url: URL) => url.origin;

async function getStay(env: Env, id: string) {
  const s = await env.DB.prepare('SELECT * FROM stays WHERE id = ?').bind(id).first<StayRow>();
  if (!s) throw new HttpError(404, 'stay_not_found');
  return s;
}

const int = (v: unknown, min: number, max: number) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, 'bad_number');
  return n;
};

export async function handleStaff(req: Request, env: Env, url: URL): Promise<Response> {
  authStaff(req, env);
  const p = url.pathname.replace(/^\/staff\/api/, '');
  const m = req.method;
  let mt: RegExpMatchArray | null;

  if (p === '/ping') return json({ ok: true, mock: isMock(env), env: env.SQUARE_ENV });

  // チェックイン：客室QR（トークン）を発行
  if (p === '/stays' && m === 'POST') {
    const b = await readJson<{ room: string; taxable: number; exempt: number; nights: number; force?: boolean }>(req);
    const room = String(b.room ?? '').trim().slice(0, 20);
    if (!room) throw new HttpError(400, 'room_required');
    const taxable = int(b.taxable, 0, 30);
    const exempt = int(b.exempt ?? 0, 0, 30);
    const nights = int(b.nights, 1, 30);
    const active = await env.DB.prepare("SELECT id FROM stays WHERE room = ? AND status != 'settled'").bind(room).first();
    if (active && !b.force) throw new HttpError(409, 'room_in_use');
    const id = newId('stay');
    const token = randomToken(24);
    await env.DB.prepare(
      'INSERT INTO stays (id, token, room, guests_taxable, guests_exempt, nights, checkin_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, token, room, taxable, exempt, nights, jstParts().date, 'active', nowIso())
      .run();
    return json({ id, url: `${origin(env, url)}/?t=${token}` });
  }

  // 現場の一覧：未精算の客室・未対応の注文とリクエスト
  if (p === '/board' && m === 'GET') {
    const stays = await env.DB.prepare("SELECT * FROM stays WHERE status != 'settled' ORDER BY room").all<StayRow>();
    const rate = Number(env.BATH_TAX_YEN);
    const rooms = [];
    for (const s of stays.results ?? []) {
      const bill = await stayBill(env, s);
      rooms.push({
        id: s.id,
        room: s.room,
        status: s.status,
        dnd: Boolean(s.dnd),
        taxable: s.guests_taxable,
        exempt: s.guests_exempt,
        nights: s.nights,
        checkinDate: s.checkin_date,
        subtotal: bill.subtotal,
        bathTax: s.bath_tax_yen ?? bathTaxAmount(s.guests_taxable, s.nights, rate),
        payUrl: s.payment_url,
        url: `${origin(env, url)}/?t=${s.token}`
      });
    }
    const orders = await env.DB.prepare(
      `SELECT o.id, o.delivery, o.status, o.total, o.created_at, s.room
         FROM orders o JOIN stays s ON s.id = o.stay_id
        WHERE o.status = 'new' ORDER BY o.created_at`
    ).all<any>();
    const ids = (orders.results ?? []).map((o) => o.id);
    const lines = ids.length
      ? await env.DB.prepare(`SELECT order_id, name, qty FROM order_lines WHERE order_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<any>()
      : { results: [] as any[] };
    const feedOrders = (orders.results ?? []).map((o) => ({ ...o, lines: (lines.results ?? []).filter((l) => l.order_id === o.id) }));
    const reqs = await env.DB.prepare(
      `SELECT r.id, r.kind, r.created_at, s.room FROM requests r JOIN stays s ON s.id = r.stay_id WHERE r.status = 'new' ORDER BY r.created_at`
    ).all<any>();
    return json({
      rooms,
      orders: feedOrders,
      requests: (reqs.results ?? []).map((r) => ({ ...r, label: REQUEST_KINDS[r.kind] ?? r.kind })),
      mock: isMock(env)
    });
  }

  if ((mt = p.match(/^\/orders\/([\w-]+)\/(deliver|cancel)$/)) && m === 'POST') {
    const [, id, action] = mt;
    if (action === 'deliver') {
      await env.DB.prepare("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ? AND status = 'new'").bind(nowIso(), id).run();
    } else {
      const o = await env.DB.prepare('SELECT s.status FROM orders o JOIN stays s ON s.id = o.stay_id WHERE o.id = ?').bind(id).first<{ status: string }>();
      if (o?.status !== 'active') throw new HttpError(409, 'stay_not_active');
      await env.DB.prepare("UPDATE orders SET status = 'canceled' WHERE id = ? AND status != 'canceled'").bind(id).run();
    }
    return json({ ok: true });
  }

  if ((mt = p.match(/^\/requests\/([\w-]+)\/done$/)) && m === 'POST') {
    await env.DB.prepare("UPDATE requests SET status = 'done', done_at = ? WHERE id = ?").bind(nowIso(), mt[1]).run();
    return json({ ok: true });
  }

  // 人数・泊数の修正（精算前のみ）
  if ((mt = p.match(/^\/stays\/([\w-]+)$/)) && m === 'PATCH') {
    const s = await getStay(env, mt[1]);
    if (s.status !== 'active') throw new HttpError(409, 'stay_not_active');
    const b = await readJson<{ taxable: number; exempt: number; nights: number }>(req);
    await env.DB.prepare('UPDATE stays SET guests_taxable = ?, guests_exempt = ?, nights = ? WHERE id = ?')
      .bind(int(b.taxable, 0, 30), int(b.exempt, 0, 30), int(b.nights, 1, 30), s.id)
      .run();
    return json({ ok: true });
  }

  // 精算：Squareの支払いリンクを発行（ゲストのスマホで支払い）
  if ((mt = p.match(/^\/stays\/([\w-]+)\/checkout$/)) && m === 'POST') {
    const s = await getStay(env, mt[1]);
    if (s.status === 'checkout_pending' && s.payment_url) return json({ payUrl: s.payment_url, total: null });
    if (s.status !== 'active') throw new HttpError(409, 'stay_not_active');
    const bill = await stayBill(env, s);
    const agg = new Map<string, number>();
    for (const o of bill.orders) if (o.status !== 'canceled') for (const l of o.lines) agg.set(l.variationId, (agg.get(l.variationId) ?? 0) + l.qty);
    const total = bill.total;
    if (total === 0) {
      await env.DB.prepare("UPDATE stays SET status = 'settled', settled_method = 'none', bath_tax_yen = 0, settled_at = ? WHERE id = ?").bind(nowIso(), s.id).run();
      return json({ settled: true, total: 0 });
    }
    let link: { id: string | null; url: string; orderId: string | null };
    if (isMock(env)) {
      link = { id: null, url: `${origin(env, url)}/mock-pay#t=${s.token}`, orderId: null };
    } else {
      link = await createCheckoutLink(env, {
        stayId: s.id,
        room: s.room,
        lines: [...agg].map(([variation_id, qty]) => ({ variation_id, qty })),
        bathTax: bill.bathTax,
        redirectUrl: `${origin(env, url)}/?t=${s.token}&paid=1`
      });
    }
    await env.DB.prepare("UPDATE stays SET status = 'checkout_pending', payment_link_id = ?, payment_url = ?, square_order_id = ?, bath_tax_yen = ? WHERE id = ?")
      .bind(link.id, link.url, link.orderId, bill.bathTax, s.id)
      .run();
    return json({ payUrl: link.url, total });
  }

  // 精算をやめて注文を再開（追加注文が出たとき）
  if ((mt = p.match(/^\/stays\/([\w-]+)\/reopen$/)) && m === 'POST') {
    const s = await getStay(env, mt[1]);
    if (s.status !== 'checkout_pending') throw new HttpError(409, 'not_pending');
    if (s.payment_link_id && !isMock(env)) await deletePaymentLink(env, s.payment_link_id);
    await env.DB.prepare("UPDATE stays SET status = 'active', payment_link_id = NULL, payment_url = NULL, square_order_id = NULL, bath_tax_yen = NULL WHERE id = ?").bind(s.id).run();
    return json({ ok: true });
  }

  // 現金など、Square以外で受け取ったときの精算済み処理
  if ((mt = p.match(/^\/stays\/([\w-]+)\/settle$/)) && m === 'POST') {
    const s = await getStay(env, mt[1]);
    if (s.status === 'settled') return json({ ok: true });
    if (s.payment_link_id && !isMock(env)) await deletePaymentLink(env, s.payment_link_id);
    const bill = await stayBill(env, s);
    await env.DB.prepare("UPDATE stays SET status = 'settled', settled_method = 'manual', bath_tax_yen = ?, settled_at = ? WHERE id = ?")
      .bind(bill.bathTax, nowIso(), s.id)
      .run();
    await desk(env).purgeMenu();
    return json({ ok: true });
  }

  // 入湯税の帳簿（月別CSV）
  if (p === '/bathtax.csv' && m === 'GET') {
    const month = url.searchParams.get('month') ?? jstParts().date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'bad_month');
    const from = `${month}-01`;
    const prev = new Date(from + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 31);
    const stays = await env.DB.prepare('SELECT room, checkin_date, nights, guests_taxable, guests_exempt FROM stays WHERE checkin_date >= ? AND checkin_date <= ?')
      .bind(prev.toISOString().slice(0, 10), `${month}-31`)
      .all<any>();
    const csv = ledgerCsv(buildLedger(stays.results ?? [], month, Number(env.BATH_TAX_YEN)));
    return new Response(csv, {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="nyutouzei-${month}.csv"` }
    });
  }

  if (p === '/menu/refresh' && m === 'POST') {
    await desk(env).purgeMenu();
    return json({ ok: true });
  }

  throw new HttpError(404, 'not_found');
}
