import "server-only";

/**
 * お問い合わせフォームの申し込みを、予約台帳の「問い合わせ」タブに入れる。
 * 受け口は booking/intake の GAS（自分として実行・合言葉で照合）。
 * BOOKING_INTAKE_URL / BOOKING_INTAKE_SECRET が未設定のあいだは何もしない。
 * （空室は予約管理の Worker から取る。lib/booking-api.ts）
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
