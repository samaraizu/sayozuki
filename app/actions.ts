"use server";

import { sendInquiryMail } from "@/lib/mail";
import { rooms } from "@/lib/site";

export type InquiryState = {
  status: "idle" | "ok" | "error";
  message?: string;
  errors?: Partial<Record<"name" | "email" | "checkin" | "guests", string>>;
};

const MEAL_LABELS: Record<string, string> = {
  none: "素泊まり",
  breakfast: "朝食付き",
  both: "1泊2食付き",
};

const todayInJapan = () =>
  new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export async function submitInquiry(
  _prev: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  // ボット対策：人には見えない欄に入力があれば受け付けたふりをして捨てる
  if (formData.get("website")) return { status: "ok" };

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name");
  const email = get("email");
  const tel = get("tel");
  const checkin = get("checkin");
  const nights = get("nights") || "1";
  const guests = get("guests");
  const room = get("room");
  const meal = get("meal");
  const message = get("message");

  const errors: InquiryState["errors"] = {};
  if (!name) errors.name = "お名前をご入力ください";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "メールアドレスをご確認ください";
  if (checkin && checkin < todayInJapan())
    errors.checkin = "本日以降の日付をお選びください";
  if (!guests) errors.guests = "人数をお選びください";
  if (Object.keys(errors).length) return { status: "error", errors };

  const roomLabel = rooms.some((r) => r.name === room) ? room : "指定なし";

  const body = [
    `お名前：${name}`,
    `メール：${email}`,
    `電話番号：${tel || "未入力"}`,
    `ご到着日：${checkin || "未定"}`,
    `泊数：${nights}泊`,
    `人数：${guests}名`,
    `ご希望の客室：${roomLabel}`,
    `お食事：${MEAL_LABELS[meal] ?? "未選択"}`,
    "",
    "ご要望・ご質問：",
    message || "（なし）",
  ].join("\n");

  const result = await sendInquiryMail(`【小夜月】ご予約のお問い合わせ（${name} 様）`, body, email);
  if ("failed" in result) {
    return {
      status: "error",
      message: "送信できませんでした。お手数ですが、時間をおいて再度お試しください。",
    };
  }

  return {
    status: "ok",
    message: "お問い合わせを承りました。空室を確認のうえ、メールにてご連絡いたします。",
  };
}
