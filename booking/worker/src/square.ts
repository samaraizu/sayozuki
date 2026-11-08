/**
 * Square（HPの事前決済）。客室オーダー（order/src/square）と同じ Square アカウント・同じ呼び方。
 * SQUARE_MOCK=1 のときは Square を呼ばず、払ったことにする（手元の確認用。本番には入れない）
 */
import type { Env } from './env';

const SQUARE_VERSION = '2025-01-23';

const base = (env: Env) =>
  env.SQUARE_ENV === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';

export const squareMock = (env: Env) => env.SQUARE_MOCK === '1';

async function sq<T>(env: Env, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) throw new Error('square_not_configured');
  const res = await fetch(base(env) + path, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN.trim()}`,
      'square-version': SQUARE_VERSION,
      'content-type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    console.error('square error', path, res.status, text);
    throw new Error(`square_error: ${data?.errors?.[0]?.detail ?? res.status}`);
  }
  return data as T;
}

export interface PayLine {
  name: string;
  quantity: number;
  /** 1つあたりの額（円） */
  unitAmount: number;
}

/** 事前決済の支払いリンク。明細は商品マスタを使わず、その場の行（ad hoc）で出す */
export async function createPaymentLink(
  env: Env,
  p: { no: string; lines: PayLine[]; email: string; redirectUrl: string; note: string },
) {
  if (squareMock(env)) {
    return { id: `mock-link-${p.no}`, orderId: `mock-order-${p.no}`, url: p.redirectUrl + '&mock=1' };
  }
  const r = await sq<{ payment_link: { id: string; url: string; order_id: string } }>(env, '/v2/online-checkout/payment-links', {
    body: {
      idempotency_key: `hp-${p.no}`,
      order: {
        location_id: env.SQUARE_LOCATION_ID!.trim(),
        reference_id: p.no,
        line_items: p.lines.map((l) => ({
          name: l.name,
          quantity: String(l.quantity),
          base_price_money: { amount: l.unitAmount, currency: 'JPY' },
        })),
        metadata: { source: 'hp', no: p.no },
      },
      checkout_options: { redirect_url: p.redirectUrl, ask_for_shipping_address: false },
      pre_populated_data: p.email ? { buyer_email: p.email } : undefined,
      payment_note: p.note,
    },
  });
  return { id: r.payment_link.id, url: r.payment_link.url, orderId: r.payment_link.order_id };
}

/** 払われたか。支払いリンクの注文は払われても OPEN のことがあるので、tender があって残額0も済みとみなす */
export function isPaidOrder(o: { state?: string; tenders?: unknown[]; net_amount_due_money?: { amount?: number } } | undefined) {
  if (!o || o.state === 'CANCELED') return false;
  return o.state === 'COMPLETED' || (Boolean(o.tenders?.length) && (o.net_amount_due_money?.amount ?? 1) === 0);
}

export async function orderPaid(env: Env, orderId: string) {
  if (squareMock(env)) return orderId.startsWith('mock-order-');
  const r = await sq<{ order: Parameters<typeof isPaidOrder>[0] }>(env, `/v2/orders/${encodeURIComponent(orderId)}`);
  return isPaidOrder(r.order);
}

/** 期限切れの支払いリンクを消す（あとから払われないように） */
export async function deletePaymentLink(env: Env, id: string) {
  if (squareMock(env) || !id) return;
  try {
    await sq(env, `/v2/online-checkout/payment-links/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {
    console.error('支払いリンクを消せなかった', e);
  }
}

/**
 * 返金（予約管理アプリの「キャンセル」）。支払いリンクの注文から支払いIDを引いて、その支払いから返金する。
 * idempotency key は予約番号で決めるので、押し直しても二重に返金しない
 */
export async function refundOrder(env: Env, p: { no: string; orderId: string; amount: number; reason: string }) {
  if (squareMock(env)) return { id: `mock-refund-${p.no}` };
  const o = await sq<{ order: { tenders?: { id?: string; payment_id?: string }[] } }>(env, `/v2/orders/${encodeURIComponent(p.orderId)}`);
  const tender = o.order.tenders?.[0];
  const paymentId = tender?.payment_id || tender?.id;
  if (!paymentId) throw new Error('square_payment_not_found');
  const r = await sq<{ refund: { id: string; status: string } }>(env, '/v2/refunds', {
    body: {
      idempotency_key: `cancel-${p.no}`,
      payment_id: paymentId,
      amount_money: { amount: p.amount, currency: 'JPY' },
      reason: p.reason.slice(0, 192),
    },
  });
  return { id: r.refund.id };
}
