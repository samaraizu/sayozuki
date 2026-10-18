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

  // 支払いリンクの決済完了 → 滞在を精算済みに
  if (type === 'payment.created' || type === 'payment.updated') {
    const pay = evt.data?.object?.payment;
    if (pay?.status === 'COMPLETED' && pay.order_id) {
      const stay = await env.DB.prepare("SELECT id, room FROM stays WHERE square_order_id = ? AND status = 'checkout_pending'")
        .bind(pay.order_id)
        .first<{ id: string; room: string }>();
      if (stay) {
        await env.DB.prepare("UPDATE stays SET status = 'settled', settled_method = 'square', settled_at = ? WHERE id = ?").bind(nowIso(), stay.id).run();
        await desk(env).purgeMenu();
        await notifyStaff(env, `✅ ${stay.room}号室 お支払い完了`);
      }
    }
  }

  return json({ ok: true });
}
