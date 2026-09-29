/**
 * お取り寄せ（日本酒）の販売設定と商品。
 * 商品はまだサンプル。実際に宿で出している銘柄が決まったら差し替える。
 */

export const shop = {
  /**
   * 注文の受付。false のあいだは注文ボタンを「販売準備中」にする。
   * インターネットで県外へ酒を売るには「通信販売酒類小売業免許」が要る。取得してから true にする。
   */
  open: false,
  name: "小夜月のお取り寄せ",
  /** 送料。決まるまでは注文後にメールで案内する */
  shippingNote: "送料は配送先の地域によって異なります。ご注文確認後、合計金額をメールでご案内いたします。",
  paymentNote: "お支払い方法（銀行振込など）は、ご注文確認のメールでご案内いたします。",
  /** 1回の注文で選べる各商品の上限 */
  maxQty: 6,
};

/**
 * 酒類販売管理者標識と特定商取引法の表記。
 * 通信販売ではサイト上に掲示が必要。免許取得後に実際の内容で埋める。
 */
export const legal = {
  seller: "小夜月株式会社",
  representative: "（代表者名）",
  address: "〒999-3242 山形県上山市葉山5-63",
  tel: "（電話番号）",
  email: "（メールアドレス）",
  license: "通信販売酒類小売業免許（取得後に記載）",
  // 以下2つは一般的な書き方の仮置き。実際の運用に合わせて直す
  shippingTime: "ご入金確認後、通常7営業日以内に発送いたします。",
  returns:
    "商品の性質上、お客様のご都合による返品はお受けできません。破損・誤配送の場合は、到着後7日以内にご連絡ください。",
  salesManager: {
    storeName: "小夜月",
    storeAddress: "山形県上山市葉山5-63",
    manager: "（酒類販売管理者の氏名）",
    trainedOn: "（研修受講年月日）",
    nextTrainingBy: "（次回研修の受講期限）",
    trainer: "（研修実施団体名）",
  },
};

export type Product = {
  id: string;
  name: string;
  /** 純米吟醸 など */
  kind: string;
  brewery: string;
  /** 蔵のある市町村 */
  town: string;
  rice: string;
  polish: string;
  abv: string;
  volume: string;
  /** 税込 */
  price: number;
  /** 味の傾向。0（甘口・淡麗）〜 4（辛口・濃醇） */
  taste: { dry: number; body: number };
  description: string;
  /** 合う料理 */
  pairing: string;
  /** 瓶のラベル色（写真が入るまでの仮の瓶に使う） */
  color: string;
  sample: true;
};

export const products: Product[] = [
  {
    id: "junmai-ginjo-dewasansan",
    name: "純米吟醸 出羽燦々",
    kind: "純米吟醸",
    brewery: "（蔵元名）",
    town: "上山市",
    rice: "出羽燦々（山形県産）",
    polish: "50%",
    abv: "15度",
    volume: "720ml",
    price: 2200,
    taste: { dry: 2, body: 1 },
    description:
      "山形が育てた酒米「出羽燦々」で醸した一本。ふわりと立つ果実のような香りと、やわらかな口当たり。冷やしてどうぞ。",
    pairing: "山菜のおひたしや、冷ややっこと。",
    color: "#2f4a5a",
    sample: true,
  },
  {
    id: "tokubetsu-junmai",
    name: "特別純米 蔵王の雪",
    kind: "特別純米",
    brewery: "（蔵元名）",
    town: "山形市",
    rice: "美山錦（山形県産）",
    polish: "60%",
    abv: "15度",
    volume: "720ml",
    price: 1800,
    taste: { dry: 3, body: 2 },
    description:
      "米のうまみを残しながら、後口はすっと切れる食中酒。冷やでも、ぬる燗でも表情が変わります。",
    pairing: "芋煮や、焼き魚など日々の献立に。",
    color: "#6a3b2c",
    sample: true,
  },
  {
    id: "daiginjo-yukimegami",
    name: "純米大吟醸 雪女神",
    kind: "純米大吟醸",
    brewery: "（蔵元名）",
    town: "天童市",
    rice: "雪女神（山形県産）",
    polish: "35%",
    abv: "16度",
    volume: "720ml",
    price: 4400,
    taste: { dry: 1, body: 1 },
    description:
      "大吟醸のために山形で生まれた酒米「雪女神」。透きとおるような香りと、絹のようになめらかな余韻。贈りものにも。",
    pairing: "お造りや、白身魚の昆布締めと。",
    color: "#1c1d22",
    sample: true,
  },
  {
    id: "honjozo-kaminoyama",
    name: "本醸造 かみのやま",
    kind: "本醸造",
    brewery: "（蔵元名）",
    town: "上山市",
    rice: "出羽の里（山形県産）",
    polish: "65%",
    abv: "15度",
    volume: "1800ml",
    price: 2600,
    taste: { dry: 4, body: 3 },
    description:
      "湯上がりの晩酌に似合う、すっきりとした辛口。熱燗にすると香りがふくらみ、からだの芯まで温まります。",
    pairing: "玉こんにゃくや、漬物をつまみに。",
    color: "#7a6a3a",
    sample: true,
  },
];

export const findProduct = (id: string) => products.find((p) => p.id === id);

/**
 * 商品に付くタグ。一覧の「#辛口」などの絞り込みに使う。
 * 商品データから決めるので、商品を差し替えればタグも変わる。
 */
export function tagsOf(p: Product): string[] {
  const tags = [p.kind];
  if (p.taste.dry >= 3) tags.push("辛口");
  if (p.taste.dry <= 1) tags.push("甘口");
  if (p.town === "上山市") tags.push("上山の酒");
  if (p.volume === "1800ml") tags.push("一升瓶");
  if (p.price >= 4000) tags.push("贈りもの");
  return tags;
}

/** 一覧に出すタグ（商品に1つでも付いているものだけ、この順で） */
export const tagOrder = ["純米大吟醸", "純米吟醸", "特別純米", "本醸造", "辛口", "甘口", "上山の酒", "贈りもの", "一升瓶"];
export const allTags = tagOrder.filter((t) => products.some((p) => tagsOf(p).includes(t)));
