/**
 * HPの予約（事前決済）の料金。画面の見積もりとサーバーの決済額の両方でこれを使う。
 * 決まりは lib/site.ts の rooms・meals・bookingRules。
 */
import { addDays } from "@/lib/availability";
import { bookingRules, directPrice, meals as mealPrices, rooms, type Room } from "@/lib/site";

export type MealPlan = "none" | "breakfast" | "dinner" | "both";
export const mealPlans: MealPlan[] = ["none", "breakfast", "dinner", "both"];

export type Quote = {
  room: Room;
  nights: number;
  guests: number;
  /** 1泊ずつの室料（追加人数・繁忙期込み）。list は定価、amount は公式サイト割引後 */
  perNight: { date: string; list: number; amount: number; busy: boolean }[];
  /** 室料の定価の合計 */
  roomList: number;
  /** 公式サイト割引の額 */
  discount: number;
  /** 割引後の室料 */
  roomTotal: number;
  extraGuests: number;
  busyNights: number;
  breakfast: number;
  dinner: number;
  mealTotal: number;
  total: number;
  /** 現地でいただく入湯税 */
  bathTax: number;
};

/** その夜（yyyy-MM-dd）が繁忙期か */
export function isBusyNight(date: string) {
  const md = date.slice(5);
  return bookingRules.busySeasons.some((s) => (s.from <= s.to ? s.from <= md && md <= s.to : md >= s.from || md <= s.to));
}

/** 1名追加ごとの額（2名料金の半分） */
export const extraGuestPrice = (room: Room) => Math.round(room.price / 2);

export function quote(roomName: string, checkIn: string, nights: number, guests: number, plan: MealPlan): Quote | null {
  const room = rooms.find((r) => r.name === roomName);
  if (!room || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return null;
  if (!Number.isInteger(nights) || nights < 1 || nights > bookingRules.maxNights) return null;
  if (!Number.isInteger(guests) || guests < 1 || guests > room.capacity) return null;
  const extraGuests = Math.max(0, guests - bookingRules.baseGuests);
  const perNight = Array.from({ length: nights }, (_, i) => {
    const date = addDays(checkIn, i);
    const busy = isBusyNight(date);
    const list = room.price + extraGuests * extraGuestPrice(room) + (busy ? bookingRules.busySurcharge : 0);
    return { date, busy, list, amount: directPrice(list) };
  });
  const roomList = perNight.reduce((s, n) => s + n.list, 0);
  const roomTotal = perNight.reduce((s, n) => s + n.amount, 0);
  const breakfast = plan === "breakfast" || plan === "both" ? mealPrices.breakfast * guests * nights : 0;
  const dinner = plan === "dinner" || plan === "both" ? mealPrices.dinner * guests * nights : 0;
  return {
    room,
    nights,
    guests,
    perNight,
    roomList,
    discount: roomList - roomTotal,
    roomTotal,
    extraGuests,
    busyNights: perNight.filter((n) => n.busy).length,
    breakfast,
    dinner,
    mealTotal: breakfast + dinner,
    total: roomTotal + breakfast + dinner,
    bathTax: bookingRules.bathTax * guests * nights,
  };
}

/** Square に出す明細（室料は割引後の額）。同じ額の夜はまとめる */
export function payLines(q: Quote, labels: { stay: string; busy: string; breakfast: string; dinner: string }) {
  const lines: { name: string; quantity: number; unitAmount: number }[] = [];
  const normal = q.perNight.filter((n) => !n.busy);
  const busy = q.perNight.filter((n) => n.busy);
  if (normal.length) lines.push({ name: labels.stay, quantity: normal.length, unitAmount: normal[0].amount });
  if (busy.length) lines.push({ name: labels.busy, quantity: busy.length, unitAmount: busy[0].amount });
  if (q.breakfast) lines.push({ name: labels.breakfast, quantity: q.guests * q.nights, unitAmount: mealPrices.breakfast });
  if (q.dinner) lines.push({ name: labels.dinner, quantity: q.guests * q.nights, unitAmount: mealPrices.dinner });
  return lines;
}
