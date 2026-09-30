import { emptyCheckout, quote, type Checkout } from "@/lib/order";

/**
 * 納品書・領収書のフォーマット案に入れるサンプルの注文。
 * 免許申請の「納品書（案）」として見せるための架空のデータ。
 */
export const sampleOrder = {
  no: "SY-261015-128",
  orderedOn: "2026年10月15日",
  shippedOn: "2026年10月17日",
  checkout: {
    ...emptyCheckout,
    name: "山形 花子",
    kana: "ヤマガタ ハナコ",
    zip: "100-0001",
    pref: "東京都",
    address: "千代田区千代田1-1",
    tel: "03-0000-0000",
    payment: "card",
  } satisfies Checkout,
  cart: { "junmai-ginjo-dewasansan": 2, "honjozo-kaminoyama": 1 },
};

export const sampleQuote = quote(sampleOrder.cart, sampleOrder.checkout.pref, sampleOrder.checkout.payment);
