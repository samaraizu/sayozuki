import { products, shop } from "@/lib/shop";

export type OrderInput = {
  items: { id: string; name: string; price: number; qty: number }[];
  name: string;
  email: string;
  tel: string;
  zip: string;
  address: string;
  birthdate: string;
  note: string;
};

export type OrderErrors = Partial<
  Record<"name" | "email" | "tel" | "zip" | "address" | "birthdate" | "adult" | "form", string>
>;

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** 日本時間の今日を基準にした満年齢 */
export function ageOn(birthdate: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = jst.getUTCFullYear() - y;
  if (jst.getUTCMonth() + 1 < mo || (jst.getUTCMonth() + 1 === mo && jst.getUTCDate() < d)) age--;
  return age;
}

/** フォームの値を読み、金額は商品データから計算し直す */
export function parseOrder(data: FormData): { input: OrderInput; errors: OrderErrors } {
  const s = (k: string) => String(data.get(k) ?? "").trim();

  const items: OrderInput["items"] = [];
  for (const p of products) {
    const n = Math.floor(Number(s(`qty_${p.id}`)));
    if (Number.isFinite(n) && n > 0) {
      items.push({ id: p.id, name: p.name, price: p.price, qty: Math.min(n, shop.maxQty) });
    }
  }

  const input: OrderInput = {
    items,
    name: s("name"),
    email: s("email"),
    tel: s("tel"),
    zip: s("zip").replace(/[^\d]/g, ""),
    address: s("address"),
    birthdate: s("birthdate"),
    note: s("note"),
  };

  const errors: OrderErrors = {};
  if (!shop.open) errors.form = "現在、ご注文の受付を準備しております。";
  if (!items.length) errors.form = "カートに商品がありません。";
  if (!input.name) errors.name = "お名前を入力してください。";
  if (!isEmail(input.email)) errors.email = "メールアドレスをご確認ください。";
  if (!input.tel) errors.tel = "電話番号を入力してください。";
  if (input.zip.length !== 7) errors.zip = "郵便番号は7桁で入力してください。";
  if (!input.address) errors.address = "お届け先の住所を入力してください。";

  const age = ageOn(input.birthdate);
  if (age === null) errors.birthdate = "生年月日を入力してください。";
  else if (age < 20) errors.birthdate = "20歳未満の方には酒類を販売しておりません。";
  if (data.get("adult") !== "on") errors.adult = "20歳以上であることをご確認ください。";

  return { input, errors };
}

export const subtotal = (items: OrderInput["items"]) =>
  items.reduce((sum, i) => sum + i.price * i.qty, 0);

export function newOrderNo(now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  const ymd = jst.slice(2, 10).replace(/-/g, "");
  return `SY-${ymd}-${Math.floor(Math.random() * 900) + 100}`;
}

export function orderSummaryText(orderNo: string, input: OrderInput): string {
  const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
  return [
    `ご注文番号：${orderNo}`,
    "",
    "■ ご注文内容",
    ...input.items.map((i) => `${i.name} × ${i.qty}　${yen(i.price * i.qty)}`),
    `小計：${yen(subtotal(input.items))}（税込・送料別）`,
    "",
    "■ お届け先",
    `お名前：${input.name}`,
    `〒${input.zip.slice(0, 3)}-${input.zip.slice(3)} ${input.address}`,
    `電話番号：${input.tel}`,
    `メール：${input.email}`,
    `生年月日：${input.birthdate}`,
    "",
    "■ ご要望",
    input.note || "（なし）",
  ].join("\n");
}

