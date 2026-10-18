import type { Env } from '../env';
import { sq } from './client';

export interface CheckoutLine {
  variation_id: string;
  qty: number;
}

/** 精算用の支払いリンク。客室注文はSquareの商品として明細化する（在庫と売上レポートに反映） */
export async function createCheckoutLink(env: Env, p: { refId: string; room: string; lines: CheckoutLine[]; redirectUrl: string }) {
  const r = await sq<{ payment_link: { id: string; url: string; order_id: string } }>(env, '/v2/online-checkout/payment-links', {
    body: {
      idempotency_key: p.refId,
      order: {
        location_id: env.SQUARE_LOCATION_ID,
        reference_id: p.refId,
        line_items: p.lines.map((l) => ({ catalog_object_id: l.variation_id, quantity: String(l.qty) })),
        metadata: { room: p.room }
      },
      checkout_options: { redirect_url: p.redirectUrl },
      payment_note: p.room
    }
  });
  return { id: r.payment_link.id, url: r.payment_link.url, orderId: r.payment_link.order_id };
}

export async function deletePaymentLink(env: Env, id: string) {
  try {
    await sq(env, `/v2/online-checkout/payment-links/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('delete link failed', e);
  }
}
