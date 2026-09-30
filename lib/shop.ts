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
  shippingNote: "送料はお届け先の地域と本数によって異なります。ご注文手続きの中で自動で計算し、確認画面で合計金額をお知らせします。",
  paymentNote: "クレジットカード・銀行振込・代金引換をご利用いただけます。",
  /** 1回の注文で選べる各商品の上限（別注商品は商品ごとに決める） */
  maxQty: 6,
};

/* ───────── 配送 ───────── */

/**
 * 受け取り方法。年齢確認のため対面受け取りのみ。
 * コンビニ・宅配ボックス受け取りは年齢確認ができないため扱わない。
 */
export const delivery = {
  method: "対面受け取り（年齢確認あり）",
  methodNote:
    "お届けの際、配達員が受取人の年齢を確認させていただく場合があります。コンビニ受け取り・宅配ボックス・置き配はご利用いただけません。",
  times: ["指定なし", "午前中", "14〜16時", "16〜18時", "18〜20時", "19〜21時"],
  /** 希望日は注文日の何日後から選べるか */
  earliestDays: 3,
  latestDays: 30,
  gifts: [
    { id: "none", label: "なし" },
    { id: "noshi", label: "のし（無料）" },
    { id: "wrap", label: "ギフト包装（無料）" },
  ],
};

/** 送料の地域。山形からの発送を前提にした区分 */
export const regions = [
  { id: "hokkaido", name: "北海道", prefs: ["北海道"] },
  { id: "kita-tohoku", name: "北東北", prefs: ["青森県", "岩手県", "秋田県"] },
  { id: "minami-tohoku", name: "南東北", prefs: ["宮城県", "山形県", "福島県"] },
  { id: "kanto", name: "関東", prefs: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "山梨県"] },
  { id: "shinetsu", name: "信越", prefs: ["新潟県", "長野県"] },
  { id: "hokuriku", name: "北陸", prefs: ["富山県", "石川県", "福井県"] },
  { id: "chubu", name: "中部", prefs: ["岐阜県", "静岡県", "愛知県", "三重県"] },
  { id: "kansai", name: "関西", prefs: ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { id: "chugoku", name: "中国", prefs: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { id: "shikoku", name: "四国", prefs: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { id: "kyushu", name: "九州", prefs: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県"] },
  { id: "okinawa", name: "沖縄", prefs: ["沖縄県"] },
] as const;

export const prefectures = regions.flatMap((r) => r.prefs as readonly string[]);

/**
 * 送料表（税込・1箱あたり）。small は四合瓶2本まで、large は6本まで。
 * 本数は四合瓶（720ml）換算で、一升瓶（1800ml）は2本と数える。
 * 金額は仮。運送会社と契約したら差し替える。
 */
export const shippingRates: Record<(typeof regions)[number]["id"], { small: number; large: number }> = {
  hokkaido: { small: 1650, large: 2200 },
  "kita-tohoku": { small: 990, large: 1430 },
  "minami-tohoku": { small: 880, large: 1320 },
  kanto: { small: 990, large: 1430 },
  shinetsu: { small: 990, large: 1430 },
  hokuriku: { small: 1100, large: 1540 },
  chubu: { small: 1100, large: 1540 },
  kansai: { small: 1210, large: 1650 },
  chugoku: { small: 1320, large: 1870 },
  shikoku: { small: 1320, large: 1870 },
  kyushu: { small: 1540, large: 2090 },
  okinawa: { small: 2200, large: 3300 },
};
export const boxCapacity = { small: 2, large: 6 };

/* ───────── お支払い ───────── */

export const payments = [
  {
    id: "card",
    label: "クレジットカード",
    note: "VISA / Mastercard / JCB / American Express。ご注文確定後、決済代行会社の画面でお支払いいただきます。",
    timing: "ご注文確定時にお支払いいただきます。",
    fee: 0,
  },
  {
    id: "bank",
    label: "銀行振込（前払い）",
    note: "ご注文確定後、振込先をメールでお知らせします。振込手数料はお客様のご負担となります。",
    timing: "ご注文から7日以内にお振り込みください。ご入金を確認してから発送いたします。",
    fee: 0,
  },
  {
    id: "cod",
    label: "代金引換",
    note: "商品のお受け取り時に配達員へお支払いください。代引手数料がかかります。",
    timing: "商品のお受け取り時にお支払いいただきます。",
    fee: 330,
  },
] as const;
export type PaymentId = (typeof payments)[number]["id"];

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
  /** 適格請求書発行事業者の登録番号。納品書・領収書に載せる */
  invoiceNo: "T（登録番号）",
  // 以下は一般的な書き方の仮置き。実際の運用に合わせて直す
  shippingTime:
    "クレジットカード・代金引換は、ご注文確定後3営業日以内に発送いたします。銀行振込は、ご入金確認後3営業日以内に発送いたします。お届け希望日のご指定がある場合はその日に合わせて発送いたします。別注商品は各商品ページに記載の納期でお届けします。",
  returns:
    "商品の性質上、お客様のご都合による返品・交換はお受けできません。商品の破損・誤配送・品質不良の場合は、到着後7日以内にご連絡ください。送料当店負担で交換または返金いたします。",
  cancel:
    "ご注文のキャンセルは、発送前に限りお受けいたします。お問い合わせ先までご連絡ください。別注商品は製造開始後のキャンセルはお受けできません。",
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
  /**
   * 通常商品か、別注・OEM（オリジナルラベルなど）か。
   * 別注は最小ロット・納期が通常と異なるので、custom に持たせる。
   */
  type: "standard" | "custom";
  custom?: {
    /** 最小注文本数 */
    minQty: number;
    /** 1回の注文の上限本数 */
    maxQty: number;
    /** お届けまでの目安 */
    leadTime: string;
  };
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
    type: "standard",
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
    type: "standard",
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
    type: "standard",
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
    type: "standard",
    sample: true,
  },
  {
    id: "original-label-junmai-ginjo",
    name: "小夜月 オリジナルラベル 純米吟醸",
    kind: "純米吟醸",
    brewery: "（蔵元名）",
    town: "上山市",
    rice: "出羽燦々（山形県産）",
    polish: "55%",
    abv: "15度",
    volume: "720ml",
    price: 2750,
    taste: { dry: 2, body: 2 },
    description:
      "小夜月のためだけに蔵元へお願いした別注ラベルの一本。宿の名前を冠した、ここでしか手に入らないお酒です。ご注文を受けてから瓶詰め・ラベル貼りを行います。",
    pairing: "季節の焼き物や、きのこの炊き込みごはんと。",
    color: "#1f6a45",
    type: "custom",
    custom: { minQty: 6, maxQty: 24, leadTime: "ご注文から約4週間でお届け" },
    sample: true,
  },
];

export const findProduct = (id: string) => products.find((p) => p.id === id);

/** 1回の注文で選べる本数の範囲 */
export const qtyRange = (p: Product) =>
  p.custom ? { min: p.custom.minQty, max: p.custom.maxQty } : { min: 1, max: shop.maxQty };

/** 送料計算用の本数（四合瓶換算） */
export const bottleUnits = (p: Product) => (p.volume === "1800ml" ? 2 : 1);

/** 都道府県から送料の地域を引く */
export const regionOf = (pref: string) => regions.find((r) => (r.prefs as readonly string[]).includes(pref));

/**
 * 送料を計算する。6本入りの箱に詰め、余りが2本以下なら小箱にする。
 * 例：7本 → 大箱1＋小箱1、9本 → 大箱2
 */
export function shippingFee(pref: string, units: number) {
  const region = regionOf(pref);
  if (!region || units <= 0) return null;
  const rate = shippingRates[region.id];
  const large = Math.floor(units / boxCapacity.large);
  const rest = units % boxCapacity.large;
  const boxes = { large: large + (rest > boxCapacity.small ? 1 : 0), small: rest > 0 && rest <= boxCapacity.small ? 1 : 0 };
  return { region: region.name, boxes, fee: boxes.large * rate.large + boxes.small * rate.small };
}

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
  if (p.type === "custom") tags.push("別注ラベル");
  return tags;
}

/** 一覧に出すタグ（商品に1つでも付いているものだけ、この順で） */
export const tagOrder = ["純米大吟醸", "純米吟醸", "特別純米", "本醸造", "辛口", "甘口", "上山の酒", "贈りもの", "一升瓶", "別注ラベル"];
export const allTags = tagOrder.filter((t) => products.some((p) => tagsOf(p).includes(t)));
