"use server";

import { redirect } from "next/navigation";
import { sendInquiryMail } from "@/lib/mail";
import { newOrderNo, orderSummaryText, parseOrder, type OrderErrors } from "@/lib/order";

/** values はエラー時に入力を戻すため（React はフォーム送信後に入力欄をリセットする） */
/** key はエラーのたびにフォームを作り直して values を確実に反映させるため */
export type OrderState = { errors: OrderErrors; values: Record<string, string>; key: string } | null;

const keep = (data: FormData) =>
  Object.fromEntries(
    ["name", "email", "tel", "zip", "address", "birthdate", "note", "adult"].map((k) => [
      k,
      String(data.get(k) ?? ""),
    ]),
  );

export async function submitOrder(_prev: OrderState, data: FormData): Promise<OrderState> {
  const { input, errors } = parseOrder(data);
  if (Object.keys(errors).length) return { errors, values: keep(data), key: crypto.randomUUID() };

  const orderNo = newOrderNo();
  const result = await sendInquiryMail(
    `【小夜月 お取り寄せ】ご注文 ${orderNo}（${input.name} 様）`,
    orderSummaryText(orderNo, input),
    input.email,
  );
  if ("failed" in result) {
    return {
      errors: { form: "送信できませんでした。お手数ですが、時間をおいて再度お試しください。" },
      values: keep(data),
      key: crypto.randomUUID(),
    };
  }

  // 注文の控えは現状メールのみ。受注管理をつなぐときはここで保存する
  redirect(`/shop/complete?no=${encodeURIComponent(orderNo)}`);
}
