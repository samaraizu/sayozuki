import { getAvailability } from "@/lib/booking-intake";

// 予約台帳の空室（部屋ごとの埋まっている夜だけ。名前などは含まない）。ご予約フォームが読む
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAvailability();
  if (!data) {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(
    { ok: true, ...data },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
