"use server";

import { redirect } from "next/navigation";
import { sendCustomerMail, sendInquiryMail } from "@/lib/mail";
import { emptyCheckout, newOrderNo, orderSummaryText, validateAll, type Checkout, type CheckoutErrors } from "@/lib/order";
import { shopPath } from "@/lib/urls";

export type OrderState = { errors: CheckoutErrors } | null;

/** 確認画面からの注文確定。ブラウザ側の計算は信用せず、ここで全項目を検証し金額を計算し直す */
export async function submitOrder(_prev: OrderState, data: FormData): Promise<OrderState> {
  let checkout: Checkout;
  let cart: Record<string, number>;
  try {
    checkout = { ...emptyCheckout, ...JSON.parse(String(data.get("checkout") ?? "{}")) };
    cart = JSON.parse(String(data.get("cart") ?? "{}"));
  } catch {
    return { errors: { form: "ご注文内容を読み取れませんでした。お手数ですが最初からやり直してください。" } };
  }
  checkout.agree = data.get("agree") === "on";

  const { errors, quote } = validateAll(checkout, cart);
  if (Object.keys(errors).length) return { errors };

  const orderNo = newOrderNo();
  const body = orderSummaryText(orderNo, checkout, quote);
  const toShop = await sendInquiryMail(`【小夜月 お取り寄せ】ご注文 ${orderNo}（${checkout.name} 様）`, body, checkout.email);
  if ("failed" in toShop) {
    return { errors: { form: "送信できませんでした。お手数ですが、時間をおいて再度お試しください。" } };
  }

  // お客様への控え。店への通知は届いているので、失敗しても注文自体は受け付ける
  await sendCustomerMail(
    checkout.email,
    `【小夜月 お取り寄せ】ご注文ありがとうございます（${orderNo}）`,
    [
      `${checkout.name} 様`,
      "",
      "このたびは小夜月のお取り寄せをご利用いただき、ありがとうございます。",
      "以下の内容でご注文を承りました。",
      "",
      body,
      "",
      "20歳未満の者の飲酒は法律で禁止されています。",
      "",
      "小夜月株式会社",
    ].join("\n"),
  );

  // 注文の控えは現状メールのみ。受注管理をつなぐときはここで保存する
  redirect(shopPath(`/complete?no=${encodeURIComponent(orderNo)}&pay=${checkout.payment}`));
}
