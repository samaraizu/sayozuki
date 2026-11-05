"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { addDays, ledgerName, roomStatus } from "@/lib/availability";
import { bookingApi, forgetAvailability, getAvailability } from "@/lib/booking-api";
import { dictionaries, fmt, formatYen, isLocale, localePath, type Locale } from "@/lib/i18n";
import { mealPlans, payLines, quote, type MealPlan } from "@/lib/pricing";
import { site } from "@/lib/site";
import { ARRIVAL_TIMES, HOLD_MINUTES } from "@/lib/reserve-config";

export type ReserveState = {
  error?: "unavailable" | "payment" | "invalid" | "agree" | "offline";
  /** 入力に問題がある項目 */
  fields?: string[];
};

/**
 * 予約の確定ボタン。料金はここで決め直し（画面の値は使わない）、予約管理に部屋の押さえを頼んで、
 * Square の支払いページへ飛ばす。押さえは HOLD_MINUTES 分で外れる
 */
export async function startReservation(_prev: ReserveState, formData: FormData): Promise<ReserveState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const langRaw = get("lang");
  const lang: Locale = isLocale(langRaw) ? langRaw : "ja";
  const t = dictionaries[lang];
  const tj = dictionaries.ja;

  const room = get("room");
  const checkIn = get("checkIn");
  const nights = parseInt(get("nights"), 10);
  const guests = parseInt(get("guests"), 10);
  const plan = (mealPlans as string[]).includes(get("meal")) ? (get("meal") as MealPlan) : "none";
  const name = get("name").slice(0, 100);
  const email = get("email").slice(0, 200);
  const tel = get("tel").slice(0, 50);
  const arrivalRaw = get("arrival");
  const arrival = ARRIVAL_TIMES.includes(arrivalRaw) ? arrivalRaw : "";
  const memo = get("memo").slice(0, 1000);

  const fields: string[] = [];
  if (!name) fields.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.push("email");
  if (!tel) fields.push("tel");
  const q = quote(room, checkIn, nights, guests, plan);
  if (!q) fields.push("stay");
  if (fields.length || !q) return { error: "invalid", fields };
  if (get("agree") !== "on") return { error: "agree" };

  const api = await bookingApi();
  if (!api) return { error: "offline" };

  // 画面を開いているあいだに埋まっていないか（押さえるときにも予約管理が確かめ直す）
  const avail = await getAvailability(true);
  if (!avail) return { error: "offline" };
  if (roomStatus(avail, q.room, checkIn, nights, guests) !== "free") return { error: "unavailable" };

  const yen = (n: number) => formatYen(lang, n);
  const roomLabel = t.rooms.names[room] ?? room;
  const out = addDays(checkIn, nights);
  const mealLabel = (d: typeof t) =>
    ({ none: d.form.mealNone, breakfast: d.form.mealBreakfast, dinner: d.book.mealDinner, both: d.form.mealBoth })[plan];
  const mealsForLedger = { none: "", breakfast: "朝食", dinner: "夕食", both: "朝食・夕食" }[plan];

  const lines = payLines(q, {
    stay: fmt(t.book.payStay, { room: roomLabel }),
    busy: fmt(t.book.payBusy, { room: roomLabel }),
    breakfast: t.book.payBreakfast,
    dinner: t.book.payDinner,
  });

  const rows = (d: typeof t, y: (n: number) => string) => [
    `${d.book.no}：{no}`,
    `${d.book.summaryRoom}：${d.rooms.names[room] ?? room}`,
    `${d.book.summaryDates}：${checkIn} → ${out}（${fmt(d.form.nightUnit, { n: nights })}）`,
    `${d.book.summaryGuests}：${fmt(d.form.guestUnit, { n: guests })}`,
    `${d.book.summaryMeal}：${mealLabel(d)}`,
    `${d.book.total}：${y(q.total)}`,
    fmt(d.book.bathTax, { price: y(q.bathTax) }),
  ];
  const guestBody = [
    fmt(t.book.mailGreeting, { name }),
    "",
    ...rows(t, yen),
    "",
    `■ ${t.book.policyTitle}`,
    ...t.book.policy.map((p) => `・${p}`),
    t.book.policyNote,
    "",
    t.book.mailFooter,
    "",
    `${site.name}（${site.roman}）`,
    `${site.postalCode} ${site.address}`,
    `TEL ${site.tel}`,
  ].join("\n");
  const innBody = [
    "HPから事前決済の予約が入りました（Squareで支払い済み）。",
    "",
    ...rows(tj, (n) => formatYen("ja", n)),
    `お名前：${name}`,
    `メール：${email}`,
    `電話：${tel}`,
    `到着予定：${arrival || "未定"}`,
    `言語：${lang}`,
    "",
    "ご要望：",
    memo || "（なし）",
  ].join("\n");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(site.url).host;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const returnUrl = `${proto}://${host}${localePath(lang, "/reserve/done")}`;

  const res = await api.startCheckout({
    room: ledgerName(room),
    checkIn,
    checkOut: out,
    guests,
    name,
    email,
    tel,
    arrival,
    meals: mealsForLedger,
    memo,
    lang,
    lines,
    amount: q.total,
    returnUrl,
    mail: {
      guestSubject: t.book.mailSubject,
      guestBody,
      innSubject: `【小夜月】HP予約（事前決済済）{no} ${room} ${checkIn}〜 ${guests}名 ${name}様`,
      innBody,
    },
  });
  forgetAvailability();
  if (!res.ok) {
    if (res.code === "unavailable") return { error: "unavailable" };
    if (res.code === "invalid") {
      console.error("[reserve] 予約管理に断られた", res.message);
      return { error: "invalid" };
    }
    return { error: "payment" };
  }
  console.info(`[reserve] ${res.no} を押さえて支払いへ（${HOLD_MINUTES}分）`);
  redirect(res.url);
}
