import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Availability } from "@/lib/availability";

/**
 * 予約管理（Worker「sayozuki-booking」）の HP専用の入口。wrangler.jsonc の services で BOOKING としてつないである。
 * 型は booking/worker/src/hp.ts と合わせる（別のパッケージなので写している）。
 * next dev のときや、つながっていないときは null（空室表示・予約は出さない）。
 */
export type PayLine = { name: string; quantity: number; unitAmount: number };

export type CheckoutInput = {
  room: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  tel: string;
  arrival: string;
  meals: string;
  memo: string;
  lang: string;
  lines: PayLine[];
  amount: number;
  returnUrl: string;
  mail: { guestSubject: string; guestBody: string; innSubject: string; innBody: string };
};

export type CheckoutResult =
  | { ok: true; no: string; key: string; url: string }
  | { ok: false; code: "invalid" | "unavailable" | "payment_error"; message?: string };

export type CheckoutStatus = {
  status: "pending" | "paid" | "expired" | "failed" | "unknown";
  no?: string;
  room?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  amount?: number;
  payUrl?: string;
};

export interface HpApi {
  calendar(days?: number): Promise<Availability>;
  startCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  checkoutStatus(no: string, key: string): Promise<CheckoutStatus>;
}

export async function bookingApi(): Promise<HpApi | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as { BOOKING?: HpApi }).BOOKING ?? null) as HpApi | null;
  } catch {
    return null;
  }
}

// 空室は20秒ためておく（D1を毎回読まない）。この Worker で予約を押さえたら捨てる
const TTL_MS = 20 * 1000;
let memo: { at: number; data: Availability } | null = null;

export function forgetAvailability() {
  memo = null;
}

/** 空室カレンダー。取れなければ null（画面は空室表示なしで動く） */
export async function getAvailability(force = false): Promise<Availability | null> {
  if (!force && memo && Date.now() - memo.at < TTL_MS) return memo.data;
  const api = await bookingApi();
  if (!api) return null;
  try {
    const d = await api.calendar(180);
    const data: Availability = {
      today: String(d.today),
      until: String(d.until),
      rooms: d.rooms.map((r) => ({
        name: String(r.name),
        capacity: Number(r.capacity) || 0,
        state: String(r.state),
        booked: Array.isArray(r.booked) ? r.booked.map(String) : [],
      })),
    };
    memo = { at: Date.now(), data };
    return data;
  } catch (e) {
    console.error("[availability] 空室が取れませんでした", e);
    return memo?.data ?? null;
  }
}
