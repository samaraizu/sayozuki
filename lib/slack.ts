import "server-only";

/**
 * お問い合わせ・お取り寄せの注文を、通知メールと同じ文で Slack の Incoming Webhook にも送る。
 * SLACK_WEBHOOK_URL（Worker「sayozuki」の Secret）が未設定なら何もしない。
 * Slack は知らせるためだけなので、失敗してもログに残すだけで受付は止めない。
 */
export async function postSlack(subject: string, body: string) {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return { sent: false as const };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: slackText(subject, body) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[slack] 送れませんでした ${res.status} ${(await res.text()).slice(0, 200)}`);
      return { sent: false as const, failed: true as const };
    }
    return { sent: true as const };
  } catch (e) {
    console.error("[slack] 送れませんでした", e);
    return { sent: false as const, failed: true as const };
  }
}

/**
 * Slack の書式にする。& < > はそのままだと Slack の記号（<!channel> やリンク）になるので置き換える。
 * お客様が書いた本文がメンションやリンクとして動かないようにするため。
 */
export function slackText(subject: string, body: string) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `*${esc(subject)}*\n${esc(body)}`;
}
