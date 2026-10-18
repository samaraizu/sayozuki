import type { Env } from '../env';
import { BATH_TAX_LABEL } from '../config/i18n-menu';
import { sq } from './client';

export interface CheckoutLine {
  variation_id: string;
  qty: number;
}

/**
 * 精算用の支払いリンクを作る。
 * 客室注文はSquareの商品として明細化し（在庫と売上レポートに反映）、入湯税は非課税の個別明細で足す。
 */
export async function createCheckoutLink(env: Env, p: { stayId: string; room: string; lines: CheckoutLine[]; bathTax: number; redirectUrl: string }) {
  const line_items: any[] = p.lines.map((l) => ({ catalog_object_id: l.variation_id, quantity: String(l.qty) }));
  if (p.bathTax > 0) {
    line_items.push({ name: BATH_TAX_LABEL, quantity: '1', base_price_money: { amount: p.bathTax, currency: 'JPY' } });
  }
  const r = await sq<{ payment_link: { id: string; url: string; order_id: string } }>(env, '/v2/online-checkout/payment-links', {
    body: {
      idempotency_key: `${p.stayId}-${line_items.length}-${p.bathTax}-${Date.now()}`,
      order: {
        location_id: env.SQUARE_LOCATION_ID,
        reference_id: p.stayId,
        line_items,
        metadata: { room: p.room, stay: p.stayId }
      },
      checkout_options: { redirect_url: p.redirectUrl },
      payment_note: `${p.room}号室`
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
