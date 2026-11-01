"use server";

import { dictionaries, isLocale, type Locale } from "@/lib/i18n";
import { sendToBookingLedger } from "@/lib/booking-intake";
import { sendInquiryMail } from "@/lib/mail";
import { rooms } from "@/lib/site";

export type InquiryState = {
  status: "idle" | "ok" | "error";
  message?: string;
  errors?: Partial<Record<"name" | "email" | "checkin" | "guests", string>>;
  /** エラー時に入力を戻すため（React はフォーム送信後に入力欄をリセットする） */
  values?: Record<string, string>;
  /** エラーのたびにフォームを作り直して values を確実に反映させるため */
  key?: string;
};

const FIELDS = ["name", "email", "tel", "checkin", "nights", "guests", "room", "meal", "message"];

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
  const langRaw = get("lang");
  const lang: Locale = isLocale(langRaw) ? langRaw : "ja";
  const t = dictionaries[lang].form;
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
  if (!name) errors.name = t.errName;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t.errEmail;
  if (checkin && checkin < todayInJapan())
    errors.checkin = t.errCheckin;
  if (!guests) errors.guests = t.errGuests;
  const values = Object.fromEntries(FIELDS.map((k) => [k, get(k)]));
  if (Object.keys(errors).length) return { status: "error", errors, values, key: crypto.randomUUID() };

  const roomLabel = rooms.some((r) => r.name === room) ? room : "指定なし";
  const id = `HP-${todayInJapan().replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6)}`;

  const body = [
    `受付番号：${id}`,
    `言語：${lang === "ja" ? "日本語" : `${dictionaries[lang].label}（${lang}）`}`,
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

  // メール通知と予約台帳（問い合わせタブ）の両方に送る。片方でも届けば受け付けたことにする
  const [mail, ledger] = await Promise.all([
    sendInquiryMail(`【小夜月】ご予約のお問い合わせ（${name} 様）`, body, email),
    sendToBookingLedger({
      id,
      lang,
      name: name.slice(0, 100),
      email: email.slice(0, 200),
      tel: tel.slice(0, 50),
      checkin: /^\d{4}-\d{2}-\d{2}$/.test(checkin) ? checkin : "",
      nights: Math.min(Math.max(parseInt(nights, 10) || 1, 1), 30),
      guests: Math.min(Math.max(parseInt(guests, 10) || 1, 1), 20),
      room: roomLabel === "指定なし" ? "" : roomLabel,
      meal: Object.hasOwn(MEAL_LABELS, meal) ? meal : "",
      message: message.slice(0, 2000),
    }),
  ]);

  // どちらにも届いていないのに「承りました」と出すと、申し込みが黙って消える。
  // 本番ではエラーにする（next dev のときだけ、ログに出して受け付けたことにする）
  const delivered = mail.sent || ledger.saved;
  if (!delivered && ("failed" in mail || "failed" in ledger || process.env.NODE_ENV === "production")) {
    console.error(`[inquiry] 申し込みをどこにも届けられませんでした（${id}）`);
    return {
      status: "error",
      values,
      key: crypto.randomUUID(),
      message: t.errSend,
    };
  }

  return {
    status: "ok",
    message: t.ok,
  };
}
