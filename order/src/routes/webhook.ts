import type { Env } from '../env';
import { verifySquareSignature } from '../lib/webhook';
import { notifyStaff } from '../lib/notify';
import { nowIso } from '../lib/time';
import { json } from '../lib/util';
import { desk } from './guest';

export async function handleSquareWebhook(req: Request, env: Env, url: URL): Promise<Response> {
  const body = await req.text();
  const key = env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return json({ error: 'not_configured' }, 503);
  const notificationUrl = `${env.PUBLIC_ORIGIN.replace(/\/$/, '')}${url.pathname}`;
  const ok = await verifySquareSignature(key, notificationUrl, body, req.headers.get('x-square-hmacsha256-signature'));
  if (!ok) return json({ error: 'bad_signature' }, 401);

  const evt = JSON.parse(body);
  const type: string = evt.type ?? '';

  // 商品・在庫・売り切れが変わったらメニューを即作り直す
  if (type.startsWith('catalog.') || type.startsWith('inventory.')) {
    await desk(env).purgeMenu();
  }

  // 支払いリンクの決済完了 → 精算済みに
  if (type === 'payment.created' || type === 'payment.updated') {
    const pay = evt.data?.object?.payment;
    if (pay?.status === 'COMPLETED' && pay.order_id) {
      const s = await env.DB.prepare(
        "SELECT s.id, s.room_id, r.name FROM settlements s JOIN rooms r ON r.id = s.room_id WHERE s.square_order_id = ? AND s.status = 'pending'"
      )
        .bind(pay.order_id)
        .first<{ id: string; room_id: string; name: string }>();
      if (s) {
        await env.DB.batch([
          env.DB.prepare("UPDATE settlements SET status = 'settled', method = 'square', settled_at = ? WHERE id = ?").bind(nowIso(), s.id),
          env.DB.prepare('UPDATE rooms SET dnd = 0 WHERE id = ?').bind(s.room_id)
        ]);
        await desk(env).purgeMenu();
        await notifyStaff(env, `✅ ${s.name} お支払い完了`);
      }
    }
  }

  return json({ ok: true });
}
