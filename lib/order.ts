import {
  bottleUnits,
  delivery,
  findProduct,
  payments,
  prefectures,
  qtyRange,
  shippingFee,
  shop,
  type PaymentId,
} from "@/lib/shop";

/**
 * ご注文手続きで入力する内容。画面を移動しても消えないようブラウザに一時保存し、
 * 注文確定時にまとめてサーバーへ送る。サーバー側でもう一度すべて検証する。
 */
export type Checkout = {
  name: string;
  kana: string;
  email: string;
  tel: string;
  zip: string;
  pref: string;
  address: string;
  birthdate: string;
  adult: boolean;
  deliveryDate: string;
  deliveryTime: string;
  gift: string;
  note: string;
  payment: PaymentId | "";
  agree: boolean;
};

export const emptyCheckout: Checkout = {
  name: "",
  kana: "",
  email: "",
  tel: "",
  zip: "",
  pref: "",
  address: "",
  birthdate: "",
  adult: false,
  deliveryDate: "",
  deliveryTime: delivery.times[0],
  gift: "none",
  note: "",
  payment: "",
  agree: false,
};

export type CheckoutErrors = Partial<Record<keyof Checkout | "cart" | "form", string>>;

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const jstToday = (now = new Date()) => new Date(now.getTime() + 9 * 60 * 60 * 1000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 日本時間の今日を基準にした満年齢 */
export function ageOn(birthdate: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const jst = jstToday(now);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = jst.getUTCFullYear() - y;
  if (jst.getUTCMonth() + 1 < mo || (jst.getUTCMonth() + 1 === mo && jst.getUTCDate() < d)) age--;
  return age;
}

/** お届け希望日として選べる範囲（YYYY-MM-DD） */
export function deliveryDateRange(now = new Date()) {
  const t = jstToday(now);
  const add = (n: number) => ymd(new Date(t.getTime() + n * 24 * 60 * 60 * 1000));
  return { min: add(delivery.earliestDays), max: add(delivery.latestDays) };
}

/** 手順1「お届け先」の検証 */
export function validateInfo(c: Checkout): CheckoutErrors {
  const e: CheckoutErrors = {};
  if (!c.name.trim()) e.name = "お名前を入力してください。";
  if (!c.kana.trim()) e.kana = "フリガナを入力してください。";
  if (!isEmail(c.email.trim())) e.email = "メールアドレスをご確認ください。";
  if (c.tel.replace(/[^\d]/g, "").length < 10) e.tel = "電話番号をご確認ください。";
  if (c.zip.replace(/[^\d]/g, "").length !== 7) e.zip = "郵便番号は7桁で入力してください。";
  if (!prefectures.includes(c.pref)) e.pref = "都道府県を選んでください。";
  if (!c.address.trim()) e.address = "ご住所を入力してください。";
  const age = ageOn(c.birthdate);
  if (age === null) e.birthdate = "生年月日を入力してください。";
  else if (age < 20) e.birthdate = "20歳未満の方には酒類を販売しておりません。";
  if (!c.adult) e.adult = "20歳以上であることをご確認ください。";
  if (c.deliveryDate) {
    const { min, max } = deliveryDateRange();
    if (c.deliveryDate < min || c.deliveryDate > max) e.deliveryDate = `${min}〜${max}の間でお選びください。`;
  }
  if (!(delivery.times as readonly string[]).includes(c.deliveryTime)) e.deliveryTime = "時間帯を選んでください。";
  if (!delivery.gifts.some((g) => g.id === c.gift)) e.gift = "のし・包装を選んでください。";
  return e;
}

/** 手順2「お支払い方法」の検証 */
export function validatePayment(c: Checkout): CheckoutErrors {
  return payments.some((p) => p.id === c.payment) ? {} : { payment: "お支払い方法を選んでください。" };
}

export type Line = { id: string; name: string; volume: string; price: number; qty: number; custom: boolean };

/** カートの中身と金額。価格・送料は必ず商品データと送料表から計算する */
export function quote(cart: Record<string, number>, pref: string, payment: PaymentId | "") {
  const lines: Line[] = [];
  const errors: string[] = [];
  for (const [id, raw] of Object.entries(cart)) {
    const p = findProduct(id);
    if (!p) continue;
    const { min, max } = qtyRange(p);
    const qty = Math.floor(Number(raw));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (qty < min || qty > max) errors.push(`${p.name}は${min}〜${max}本でご注文ください。`);
    lines.push({ id, name: p.name, volume: p.volume, price: p.price, qty, custom: p.type === "custom" });
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const units = lines.reduce((s, l) => s + bottleUnits(findProduct(l.id)!) * l.qty, 0);
  const ship = pref ? shippingFee(pref, units) : null;
  const fee = payments.find((p) => p.id === payment)?.fee ?? 0;
  const total = subtotal + (ship?.fee ?? 0) + fee;
  return {
    lines,
    errors,
    subtotal,
    units,
    shipping: ship,
    paymentFee: fee,
    total,
    /** 税込合計に含まれる消費税（酒類は10%） */
    tax: Math.floor((total * 10) / 110),
  };
}

export type Quote = ReturnType<typeof quote>;

/** 注文確定時の総チェック。サーバー側で呼ぶ */
export function validateAll(c: Checkout, cart: Record<string, number>) {
  const q = quote(cart, c.pref, c.payment);
  const e: CheckoutErrors = { ...validateInfo(c), ...validatePayment(c) };
  if (!q.lines.length) e.cart = "カートに商品がありません。";
  else if (q.errors.length) e.cart = q.errors.join(" ");
  if (!c.agree) e.agree = "ご注文内容と特定商取引法に基づく表記への同意が必要です。";
  if (!shop.open) e.form = "現在、ご注文の受付を準備しております。";
  return { errors: e, quote: q };
}

export function newOrderNo(now = new Date()): string {
  const d = jstToday(now).toISOString().slice(2, 10).replace(/-/g, "");
  return `SY-${d}-${Math.floor(Math.random() * 900) + 100}`;
}

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export function orderSummaryText(orderNo: string, c: Checkout, q: Quote): string {
  const pay = payments.find((p) => p.id === c.payment);
  const gift = delivery.gifts.find((g) => g.id === c.gift);
  return [
    `ご注文番号：${orderNo}`,
    "",
    "■ ご注文内容",
    ...q.lines.map((l) => `${l.name}（${l.volume}）× ${l.qty}　${yen(l.price * l.qty)}${l.custom ? "　※別注" : ""}`),
    `商品小計：${yen(q.subtotal)}`,
    `送料：${q.shipping ? `${yen(q.shipping.fee)}（${q.shipping.region}・大箱${q.shipping.boxes.large}／小箱${q.shipping.boxes.small}）` : "—"}`,
    ...(q.paymentFee ? [`代引手数料：${yen(q.paymentFee)}`] : []),
    `合計：${yen(q.total)}（うち消費税 ${yen(q.tax)}）`,
    "",
    "■ お支払い",
    pay?.label ?? "—",
    "",
    "■ お届け先",
    `${c.name}（${c.kana}）様`,
    `〒${c.zip} ${c.pref}${c.address}`,
    `電話番号：${c.tel}`,
    `メール：${c.email}`,
    `生年月日：${c.birthdate}（20歳以上の確認済み）`,
    `受け取り方法：${delivery.method}`,
    `お届け希望：${c.deliveryDate || "指定なし"}　${c.deliveryTime}`,
    `のし・包装：${gift?.label ?? "なし"}`,
    "",
    "■ ご要望",
    c.note || "（なし）",
  ].join("\n");
}
