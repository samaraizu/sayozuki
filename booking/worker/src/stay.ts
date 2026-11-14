/**
 * いまお客様がいる部屋（客室オーダーのスタッフ画面「客室」の数に使う。index.ts の OrderApi から呼ぶ）。
 * 泊まりは「夜」で数える。日本時間の12時までは前の晩の泊まり（チェックアウト前の人）、12時からはその晩の泊まり。
 * キャンセル以外の予約で、部屋が決まっているものだけ。
 */
import { Lib } from './lib.gen.js';
import { todayIso, type Env } from './env';

export const SWITCH_HOUR = 12;

/** いま数える「夜」の日付（YYYY-MM-DD） */
export function currentNight(now = new Date()): string {
  const today = todayIso(now);
  const hour = Number(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false })) % 24;
  return hour < SWITCH_HOUR ? Lib.addDays(today, -1) : today;
}

export async function occupiedRooms(env: Env, now = new Date()): Promise<{ night: string; rooms: string[] }> {
  const night = currentNight(now);
  const res = await env.DB.prepare(
    `SELECT DISTINCT room FROM bookings
      WHERE status <> 'キャンセル' AND room <> '' AND check_in <= ?1 AND check_out > ?1`,
  )
    .bind(night)
    .all<{ room: string }>();
  return { night, rooms: (res.results ?? []).map((r) => String(r.room)) };
}
