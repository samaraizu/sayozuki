import type { Env } from '../env';
import { roomBill } from '../routes/guest';
import { closeChat } from './chat';
import { notifyStaff } from './notify';
import { hhmmToMin, jstParts, nowIso } from './time';

/** チェックアウト（10:00）のあと、前のお客様の会話などを片付ける時刻（日本時間） */
export const RESET_AT = '11:00';

export const resetKey = (roomId: string) => `reset_at:${roomId}`;

/** 客室オーダーの「201号室」と予約管理の「201」をそろえる */
export const roomKey = (name: string) => String(name).replace(/号室$/, '').trim();

/**
 * その日にチェックアウトした部屋（予約管理の台帳から）を、次のお客様向けに片付ける。毎分の定期実行から呼び、1日1回だけ動く。
 * - 会話を閉じる・「起こさないで」を切る・未対応のリクエストを済みにする・領収書を見せるのはこれより後の精算だけにする
 * - 精算が残っていれば（注文は消せないので）スタッフに知らせる
 * 精算を済ませた部屋は精算のときにもう片付いている。これは何も注文しなかった部屋・精算し忘れた部屋のため
 */
export async function resetDepartedRooms(env: Env, now = new Date()) {
  if (!env.BOOKING) return null;
  const { date, minutes } = jstParts(now);
  if (minutes < hhmmToMin(RESET_AT)) return null;
  const done = await env.DB.prepare("SELECT value FROM settings WHERE key = 'lastReset'").first<{ value: string }>();
  if (done?.value === date) return null;

  let departed: Set<string>;
  try {
    departed = new Set((await env.BOOKING.departed(date)).rooms.map(roomKey));
  } catch (e) {
    console.error('予約管理からチェックアウトした部屋を取れなかった（次の回にもう一度）', e);
    return null;
  }
  // 先に「今日はやった」を書く（同時に動いても二重に片付けない）
  const claim = await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('lastReset', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value <> ?1"
  )
    .bind(date)
    .run();
  if (!claim.meta.changes) return null;

  const at = nowIso();
  const rooms = (await env.DB.prepare('SELECT id, name FROM rooms ORDER BY sort, name').all<{ id: string; name: string }>()).results ?? [];
  const reset: string[] = [];
  for (const r of rooms) {
    if (!departed.has(roomKey(r.name))) continue;
    await env.DB.batch([
      env.DB.prepare('UPDATE rooms SET dnd = 0 WHERE id = ?').bind(r.id),
      // 片付けた時刻（領収書はこれより後の精算だけ見せる）。デプロイで表を作り替えないので settings に置く
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(resetKey(r.id), at),
      closeChat(env, r.id),
      env.DB.prepare("UPDATE requests SET status = 'done', done_at = ? WHERE room_id = ? AND status = 'new'").bind(at, r.id)
    ]);
    reset.push(r.name);
    const bill = await roomBill(env, r.id);
    const left = bill.unsettledTotal + bill.pendingTotal;
    if (left > 0) await notifyStaff(env, `⚠️ ${r.name} はチェックアウト済みですが、精算が ¥${left.toLocaleString('ja-JP')} 残っています`);
  }
  // 古いPINの間違いの記録を消す
  await env.DB.prepare("DELETE FROM settings WHERE key LIKE 'pinfail:%' AND json_extract(value, '$.since') < ?")
    .bind(now.getTime() - 86400_000)
    .run();
  if (reset.length) console.log('チェックアウトした部屋を片付けた', reset.join('・'));
  return { date, reset };
}

/** いまお客様がいる部屋か。分からなければ null */
export async function isOccupied(env: Env, roomName: string): Promise<boolean | null> {
  if (!env.BOOKING) return null;
  try {
    return (await env.BOOKING.occupied()).rooms.map(roomKey).includes(roomKey(roomName));
  } catch {
    return null;
  }
}
