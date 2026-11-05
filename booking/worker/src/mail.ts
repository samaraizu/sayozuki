/**
 * 確認メール（Resend）。RESEND_API_KEY / MAIL_FROM が未設定のあいだは送らずにログへ出す。
 * MAIL_TO（宿の通知先、カンマ区切り）があれば、新しいHP予約を知らせる。
 */
import type { Env } from './env';

export async function sendMail(env: Env, to: string | string[], subject: string, text: string, replyTo?: string) {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  const list = (Array.isArray(to) ? to : [to]).map((s) => s.trim()).filter(Boolean);
  if (!list.length) return false;
  if (!key || !from) {
    console.log(`[mail] 未設定のため送らなかった：${subject}`);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: list, subject, text, reply_to: replyTo }),
  });
  if (!res.ok) {
    console.error('[mail] 送れなかった', res.status, await res.text());
    return false;
  }
  return true;
}

export const innAddresses = (env: Env) =>
  String(env.MAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
