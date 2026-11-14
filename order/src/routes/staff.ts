import type { Env } from '../env';
import { isMock } from '../env';
import { REQUEST_KINDS } from '../config/requests';
import { nowIso } from '../lib/time';
import { HttpError, json, newId, readJson, timingSafeEqual } from '../lib/util';
import { closeChat, forStaff, openMessages, staffSend, type MessageRow } from '../lib/chat';
import { notifyStaff } from '../lib/notify';
import { vapid } from '../lib/push';
import { markSettled, syncPendingPayments } from '../lib/settle';
import { createCheckoutLink, deletePaymentLink } from '../square/checkout';
import { addImage, archiveItem, changeImage, createItem, heldCounts, parseInput, suggestTr, updateItem } from '../square/admin';
import { desk, pendingSettlement, roomBill, type RoomRow } from './guest';
import { setDraft } from '../square/detail';

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

export async function handleStaff(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  authStaff(req, env);
  const p = url.pathname.replace(/^\/staff\/api/, '');
  const m = req.method;
  let mt: RegExpMatchArray | null;

  if (p === '/ping') return json({ ok: true, mock: isMock(env), env: env.SQUARE_ENV });

  // 現場の一覧
  if (p === '/board' && m === 'GET') {
    await syncPendingPayments(env);
    const rooms = await env.DB.prepare('SELECT * FROM rooms ORDER BY sort, name').all<RoomRow>();
    const chats = await env.DB.prepare(
      `SELECT m.* FROM messages m
        JOIN (SELECT room_id, MAX(created_at) AS last FROM messages WHERE closed = 0 GROUP BY room_id) x
          ON x.room_id = m.room_id AND x.last = m.created_at
       WHERE m.closed = 0`
    ).all<MessageRow>();
    const unread = await env.DB.prepare(
      "SELECT room_id, COUNT(*) AS n FROM messages WHERE closed = 0 AND sender = 'guest' AND read_at IS NULL GROUP BY room_id"
    ).all<{ room_id: string; n: number }>();
    // いまお客様がいる部屋（予約管理の台帳から。名前は「201号室」と「201」のように「号室」を外して突き合わせる）
    const roomKey = (name: string) => String(name).replace(/号室$/, '').trim();
    let occupied: Set<string> | null = null;
    try {
      if (env.BOOKING) occupied = new Set((await env.BOOKING.occupied()).rooms.map(roomKey));
    } catch (e) {
      console.error('予約管理から滞在中の部屋を取れなかった', e);
    }
    const list = [];
    for (const r of rooms.results ?? []) {
      const bill = await roomBill(env, r.id);
      const last = (chats.results ?? []).find((m) => m.room_id === r.id);
      list.push({
        id: r.id,
        name: r.name,
        dnd: Boolean(r.dnd),
        unsettled: bill.unsettledTotal,
        pendingTotal: bill.pendingTotal,
        payUrl: bill.payUrl,
        url: roomUrl(url, r.id),
        stay: occupied ? occupied.has(roomKey(r.name)) : null,
        chat: last ? { unread: (unread.results ?? []).find((u) => u.room_id === r.id)?.n ?? 0, last: forStaff(last) } : null
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

  // お支払いが済んだかをSquareに確かめる（Webhookが届かないとき用）
  if ((mt = p.match(/^\/rooms\/([\w-]+)\/verify$/)) && m === 'POST') {
    const room = await getRoom(env, mt[1]);
    if (!(await pendingSettlement(env, room.id))) return json({ paid: true });
    return json({ paid: (await syncPendingPayments(env, { roomId: room.id, force: true })).includes(room.id) });
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
      await markSettled(env, s.id, room.id, 'manual');
      return json({ ok: true });
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
    await env.DB.batch([env.DB.prepare('UPDATE rooms SET dnd = 0 WHERE id = ?').bind(room.id), closeChat(env, room.id)]);
    await desk(env).purgeMenu();
    return json({ ok: true });
  }

  // チャット：部屋ごとの会話を開く（開いた時点でお客様のメッセージは既読にする）
  if ((mt = p.match(/^\/chat\/([\w-]+)$/)) && m === 'GET') {
    const room = await getRoom(env, mt[1]);
    await env.DB.prepare("UPDATE messages SET read_at = ? WHERE room_id = ? AND sender = 'guest' AND closed = 0 AND read_at IS NULL").bind(nowIso(), room.id).run();
    return json({ room: { id: room.id, name: room.name }, messages: (await openMessages(env, room.id)).map(forStaff) });
  }

  if ((mt = p.match(/^\/chat\/([\w-]+)$/)) && m === 'POST') {
    const room = await getRoom(env, mt[1]);
    await staffSend(env, room.id, await readJson<{ text?: string }>(req));
    return json({ room: { id: room.id, name: room.name }, messages: (await openMessages(env, room.id)).map(forStaff) });
  }

  // チェックアウトしたお客様の会話を閉じる（精算が済んだときは自動で閉じる）
  if ((mt = p.match(/^\/chat\/([\w-]+)\/close$/)) && m === 'POST') {
    const room = await getRoom(env, mt[1]);
    await closeChat(env, room.id).run();
    return json({ ok: true });
  }

  // スマホへの通知
  if (p === '/push/key' && m === 'GET') return json({ key: (await vapid(env)).pub });

  if (p === '/push/subscribe' && m === 'POST') {
    const { endpoint } = await readJson<{ endpoint?: string }>(req);
    if (!endpoint || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) throw new HttpError(400, 'bad_endpoint');
    await env.DB.prepare('INSERT OR IGNORE INTO push_subs (endpoint, created_at) VALUES (?, ?)').bind(endpoint, nowIso()).run();
    return json({ ok: true });
  }

  if (p === '/push/unsubscribe' && m === 'POST') {
    const { endpoint } = await readJson<{ endpoint?: string }>(req);
    await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(String(endpoint ?? '')).run();
    return json({ ok: true });
  }

  // 通知を受け取ったスマホが、表示する一文を取りにくる
  if (p === '/push/latest' && m === 'GET') {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'latest'").first<{ value: string }>();
    return json(row ? JSON.parse(row.value) : { text: null });
  }

  if (p === '/push/test' && m === 'POST') {
    ctx.waitUntil(notifyStaff(env, '🔔 通知のテストです。このスマホに届いています。'));
    return json({ ok: true });
  }

  if (p === '/menu/refresh' && m === 'POST') {
    await desk(env).purgeMenu();
    return json({ ok: true });
  }

  // メニューの管理：一覧・追加・編集・掲載をやめる・写真
  if (p === '/menu' && m === 'GET') return json(await staffMenu(env));

  if (p === '/menu' && m === 'POST') {
    const body = await readJson<any>(req);
    const id = await createItem(env, parseInput(body));
    // 新しい商品は下書きで入れる（「保存して公開」なら公開）
    await setDraft(env, id, body?.publish !== true);
    // 用意してある紹介（public/dishes.js）から作ったとき：その写真を Square の商品写真にする
    for (const path of Array.isArray(body?.seedPhotos) ? body.seedPhotos.slice(0, 6) : []) {
      if (typeof path !== 'string' || !/^\/images\/menu\/[\w-]+\.(jpe?g|png)$/.test(path)) continue;
      const r = await env.ASSETS.fetch(new Request(new URL(path, req.url)));
      if (r.ok) await addImage(env, id, new Blob([await r.arrayBuffer()], { type: path.endsWith('.png') ? 'image/png' : 'image/jpeg' }));
    }
    return json({ id, ...(await staffMenu(env)) });
  }

  // 下書き ⇄ 公開
  if ((mt = p.match(/^\/menu\/([\w-]+)\/(publish|unpublish)$/)) && m === 'POST') {
    await setDraft(env, mt[1], mt[2] === 'unpublish');
    return json(await staffMenu(env));
  }

  if (p === '/menu/translate' && m === 'POST') {
    const b = await readJson<{ name?: string; desc?: string }>(req);
    return json(await suggestTr(env, String(b.name ?? '').slice(0, 60), String(b.desc ?? '').slice(0, 300)));
  }

  if ((mt = p.match(/^\/menu\/([\w-]+)$/)) && m === 'PUT') {
    await updateItem(env, mt[1], parseInput(await readJson(req)));
    return json(await staffMenu(env));
  }

  if ((mt = p.match(/^\/menu\/([\w-]+)\/archive$/)) && m === 'POST') {
    await archiveItem(env, mt[1]);
    return json(await staffMenu(env));
  }

  if ((mt = p.match(/^\/menu\/([\w-]+)\/images$/)) && m === 'POST') {
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim();
    await addImage(env, mt[1], new Blob([await req.arrayBuffer()], { type }));
    return json(await staffMenu(env));
  }

  if ((mt = p.match(/^\/menu\/([\w-]+)\/images\/([\w-]+)(\/first)?$/)) && (m === 'DELETE' || (m === 'POST' && mt[3]))) {
    await changeImage(env, mt[1], mt[2], m === 'DELETE' ? 'remove' : 'first');
    return json(await staffMenu(env));
  }

  throw new HttpError(404, 'not_found');
}

/** スタッフ画面のメニュー一覧（Squareから読み直す。精算前の注文で押さえている数も添える） */
async function staffMenu(env: Env) {
  const d = desk(env);
  await d.purgeMenu();
  const menu = await d.getMenu(true);
  return {
    categories: menu.categories.map((c) => ({ name: c.name, cutoff: c.cutoff ?? null, preorder: Boolean(c.preorder) })),
    items: menu.items.map((i) => ({
      itemId: i.itemId,
      id: i.id,
      name: i.name,
      desc: i.desc,
      names: i.names,
      descs: i.descs,
      price: i.price,
      category: i.category,
      tracked: i.tracked,
      stock: i.stock,
      paused: i.paused,
      soldOut: i.soldOut,
      images: i.images.map((url, n) => ({ id: i.imageIds[n], url })),
      detail: i.detail,
      draft: i.draft
    })),
    held: await heldCounts(env),
    mock: isMock(env)
  };
}
