import type { Env } from '../env';

/** スタッフ通知（Slack互換のIncoming Webhook）。未設定ならスタッフ画面のポーリングだけで受ける */
export async function notifyStaff(env: Env, text: string) {
  if (!env.NOTIFY_SLACK_WEBHOOK) return;
  try {
    await fetch(env.NOTIFY_SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text })
    });
  } catch (e) {
    console.error('notify failed', e);
  }
}
