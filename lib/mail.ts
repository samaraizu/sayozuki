import "server-only";

/**
 * ご予約・お問い合わせの通知メール。
 * RESEND_API_KEY が未設定のあいだは送信せず、サーバーのログに出すだけにしている。
 * 送信元ドメインの認証と宛先が決まったら .env.local に入れる。
 */
export async function sendInquiryMail(subject: string, body: string, replyTo?: string) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_MAIL_TO;
  const from = process.env.INQUIRY_MAIL_FROM;

  if (!key || !to || !from) {
    console.info(`[inquiry] メール未設定のため送信しませんでした\n${subject}\n${body}`);
    return { sent: false as const };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: to.split(",").map((s) => s.trim()),
    subject,
    text: body,
    replyTo,
  });

  if (error) {
    console.error("[inquiry] メール送信に失敗しました", error);
    return { sent: false as const, failed: true as const };
  }
  return { sent: true as const };
}
