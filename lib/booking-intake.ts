import "server-only";
import type { Availability } from "@/lib/availability";

/**
 * 予約管理の台帳とのやりとり。受け口は booking/intake の GAS（自分として実行・合言葉で照合）。
 * - sendToBookingLedger : ご予約フォームの申し込みを「問い合わせ」タブに入れる
 * - getAvailability     : 部屋ごとの埋まっている夜を取る（HPの空室表示）
 * BOOKING_INTAKE_URL / BOOKING_INTAKE_SECRET が未設定のあいだはどちらも何もしない。
 */
export type IntakeRecord = {
  /** 受付番号。送り直しても台帳で二重にならないよう、こちらで決める */
  id: string;
  lang: string;
  name: string;
  email: string;
  tel: string;
  checkin: string;
  nights: number;
  guests: number;
  room: string;
  /** none / breakfast / both */
  meal: string;
  message: string;
};

export type IntakeResult = { saved: true } | { saved: false; failed?: true };

type GasReply = { ok?: boolean; message?: string } & Record<string, unknown>;

/** 受付用GASを呼ぶ。未設定なら null */
async function callIntake(payload: Record<string, unknown>, timeoutMs: number) {
  const url = process.env.BOOKING_INTAKE_URL;
  const secret = process.env.BOOKING_INTAKE_SECRET;
  if (!url || !secret) return null;
  // GAS の /exec は 302 で結果のURLへ飛ばすので、そのままたどる
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, ...payload }),
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => null)) as GasReply | null;
  return { status: res.status, ok: res.ok && !!data?.ok, data };
}

export async function sendToBookingLedger(record: IntakeRecord): Promise<IntakeResult> {
  try {
    const r = await callIntake({ record }, 10_000);
    if (!r) {
      console.info(`[intake] 台帳への連携が未設定のため送りませんでした（${record.id}）`);
      return { saved: false };
    }
    if (!r.ok) {
      console.error("[intake] 台帳への書き込みに失敗しました", r.status, r.data?.message ?? "");
      return { saved: false, failed: true };
    }
    return { saved: true };
  } catch (e) {
    console.error("[intake] 台帳に届きませんでした", e);
    return { saved: false, failed: true };
  }
}

// 空室は5分ためておく（GASは1回1〜2秒かかり、1日の実行回数にも上限がある）
const TTL_MS = 5 * 60 * 1000;
let memo: { at: number; data: Availability } | null = null;
let pending: Promise<Availability | null> | null = null;

/** 空室。取れなければ null（画面は空室表示なしで今までどおり動く） */
export async function getAvailability(): Promise<Availability | null> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.data;
  // 同時に来たリクエストは1回のGAS呼び出しにまとめる
  pending ??= (async () => {
    try {
      const r = await callIntake({ action: "availability" }, 8_000);
      if (!r) return null;
      const d = r.data;
      if (!r.ok || !d || typeof d.today !== "string" || typeof d.until !== "string" || !Array.isArray(d.rooms)) {
        console.error("[availability] 空室が取れませんでした", r.status, d?.message ?? "");
        return memo?.data ?? null;
      }
      const data: Availability = {
        today: d.today,
        until: d.until,
        rooms: (d.rooms as Availability["rooms"]).map((x) => ({
          name: String(x.name),
          capacity: Number(x.capacity) || 0,
          state: String(x.state),
          booked: Array.isArray(x.booked) ? x.booked.map(String) : [],
        })),
      };
      memo = { at: Date.now(), data };
      return data;
    } catch (e) {
      console.error("[availability] 空室が取れませんでした", e);
      // 取れなかったときは、古くても直前の値を使う
      return memo?.data ?? null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
