import type { Env } from '../env';
import { pushStaff } from './push';

/**
 * スタッフへの通知。スタッフのスマホへのプッシュ通知と、Slack互換のIncoming Webhook（設定したときだけ）。
 * どちらかが失敗しても注文やチャットの受付は止めない。
 */
export async function notifyStaff(env: Env, text: string, link?: string) {
  await Promise.all([
    pushStaff(env, text, link).catch((e) => console.error('push failed', e)),
    env.NOTIFY_SLACK_WEBHOOK
      ? fetch(env.NOTIFY_SLACK_WEBHOOK, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text })
        }).catch((e) => console.error('slack failed', e))
      : null
  ]);
}
