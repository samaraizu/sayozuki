import type { Env } from '../env';
import { isMock } from '../env';
import { orderPaid } from '../square/checkout';
import { desk } from '../routes/guest';
import { closeChat } from './chat';
import { notifyStaff } from './notify';
import { nowIso } from './time';

/**
 * お支払い待ちの精算を済みにする（Squareの支払い完了・現金での受領・モックの支払いで共通）。
 * 部屋は「起こさないで」を切り、会話を閉じて次のお客様向けに戻す。すでに済んでいれば何もせず false
 */
export async function markSettled(env: Env, settlementId: string, roomId: string, method: 'square' | 'manual') {
  const [r] = await env.DB.batch([
    env.DB.prepare("UPDATE settlements SET status = 'settled', method = ?, settled_at = ? WHERE id = ? AND status = 'pending'").bind(method, nowIso(), settlementId),
    env.DB.prepare('UPDATE rooms SET dnd = 0 WHERE id = ?').bind(roomId),
    closeChat(env, roomId)
  ]);
  await desk(env).purgeMenu();
  return (r.meta.changes ?? 0) > 0;
}

/** 同じ精算をSquareに問い合わせる間隔（Webhookの代わりに画面の読み込みから確かめるので、間を空ける） */
const RECHECK_MS = 20_000;
const lastChecked = new Map<string, number>();

/**
 * SquareのWebhookを使わずに、お支払い待ちの精算が支払われたかを Orders API で確かめる。
 * 定期実行（cron）・スタッフ画面の一覧・お客様のお会計タブ・スタッフの「支払いを確認」から呼ぶ。
 * Webhookを登録した後も、取りこぼしの保険として残しておく
 */
export async function syncPendingPayments(env: Env, opts: { roomId?: string; force?: boolean } = {}) {
  if (isMock(env) || !env.SQUARE_ACCESS_TOKEN) return [];
  const rows = await env.DB.prepare(
    `SELECT s.id, s.room_id, s.square_order_id, r.name FROM settlements s JOIN rooms r ON r.id = s.room_id
      WHERE s.status = 'pending' AND s.square_order_id IS NOT NULL ${opts.roomId ? 'AND s.room_id = ?' : ''}`
  )
    .bind(...(opts.roomId ? [opts.roomId] : []))
    .all<{ id: string; room_id: string; square_order_id: string; name: string }>();
  const now = Date.now();
  const settled: string[] = [];
  for (const s of rows.results ?? []) {
    if (!opts.force && now - (lastChecked.get(s.id) ?? 0) < RECHECK_MS) continue;
    lastChecked.set(s.id, now);
    try {
      if (!(await orderPaid(env, s.square_order_id))) continue;
    } catch (e) {
      console.error('payment check failed', s.id, e);
      continue;
    }
    if (await markSettled(env, s.id, s.room_id, 'square')) {
      lastChecked.delete(s.id);
      settled.push(s.room_id);
      await notifyStaff(env, `✅ ${s.name} お支払い完了`);
    }
  }
  return settled;
}
