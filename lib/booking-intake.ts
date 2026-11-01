import "server-only";

/**
 * HPのご予約フォームの申し込みを、予約管理の台帳（スプシの「問い合わせ」タブ）に送る。
 * 受け口は booking/intake の GAS（自分として実行・合言葉で照合）。
 * BOOKING_INTAKE_URL / BOOKING_INTAKE_SECRET が未設定のあいだは送らない。
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

export async function sendToBookingLedger(record: IntakeRecord): Promise<IntakeResult> {
  const url = process.env.BOOKING_INTAKE_URL;
  const secret = process.env.BOOKING_INTAKE_SECRET;
  if (!url || !secret) {
    console.info(`[intake] 台帳への連携が未設定のため送りませんでした（${record.id}）`);
    return { saved: false };
  }

  try {
    // GAS の /exec は 302 で結果のURLへ飛ばすので、そのままたどる
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, record }),
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (!res.ok || !data?.ok) {
      console.error("[intake] 台帳への書き込みに失敗しました", res.status, data?.message ?? "");
      return { saved: false, failed: true };
    }
    return { saved: true };
  } catch (e) {
    console.error("[intake] 台帳に届きませんでした", e);
    return { saved: false, failed: true };
  }
}
