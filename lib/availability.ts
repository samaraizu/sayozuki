/**
 * 空室の判定。予約管理（D1）から届いた「部屋ごとの埋まっている夜」を、
 * HPの客室（lib/site.ts の rooms）に当てはめる。サーバーと画面の両方で使う。
 */

/** 予約管理が返す形（booking/worker/src/hp.ts の calendar） */
export type Availability = {
  /** 台帳側の今日（yyyy-MM-dd、日本時間） */
  today: string;
  /** この日の前の夜まで分かる（この日以降は分からない） */
  until: string;
  rooms: { name: string; capacity: number; state: string; booked: string[] }[];
};

/**
 * free    : 空いている
 * full    : 埋まっている夜がある
 * over    : 人数が定員を超える
 * closed  : 台帳で「販売可」になっていない（準備中・停止）
 * unknown : 台帳にない部屋、または分かる範囲の外の日程（宿が確かめる）
 */
export type RoomStatus = "free" | "full" | "over" | "closed" | "unknown";

const SELLABLE = "販売可";

/** HPの「201号室」と台帳の「201」をそろえる */
export const ledgerName = (hpName: string) => hpName.replace(/号室$/, "");

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 泊まる夜（チェックイン日〜チェックアウト前日） */
export function nightsOf(checkin: string, nights: number) {
  return Array.from({ length: nights }, (_, i) => addDays(checkin, i));
}

/**
 * HPの客室1つについて、その日程・人数で入れるか。
 * capacity は HP に載せている定員（lib/site.ts）。台帳の定員が小さければそちらに合わせる
 */
export function roomStatus(
  data: Availability,
  room: { name: string; capacity: number },
  checkin: string,
  nights: number,
  guests: number,
): RoomStatus {
  const entry = data.rooms.find((r) => r.name === ledgerName(room.name));
  if (!entry) return "unknown";
  if (entry.state !== SELLABLE) return "closed";
  const cap = Math.min(room.capacity, entry.capacity || room.capacity);
  if (guests > cap) return "over";
  const stay = nightsOf(checkin, nights);
  if (stay[0] < data.today || stay[stay.length - 1] >= data.until) return "unknown";
  const booked = new Set(entry.booked);
  return stay.some((n) => booked.has(n)) ? "full" : "free";
}
