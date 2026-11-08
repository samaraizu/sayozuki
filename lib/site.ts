/**
 * 宿の基本情報。Notion「事業01 | 小夜月」の内容をもとにしている。
 * 料金や部屋が変わったらここだけ直せばページ全体に反映される。
 */

export const site = {
  name: "小夜月",
  kana: "さよづき",
  roman: "SAYOZUKI",
  tagline: "かみのやま温泉　湯の宿",
  company: "小夜月株式会社",
  postalCode: "〒999-3242",
  address: "山形県上山市葉山5-63",
  url: "https://sayozuki.com",
  openDays: "年中無休で営業しております",
  // Google ビジネスプロフィール（現在の登録名は「旅館 静山荘 次元ブレッド」）
  gbpUrl: "https://share.google/ZoLhpDujEC7RIG0Xq",
  tel: "023-679-5511",
  fax: "023-679-5514",
  /** 宿のページの「SAKE（お取り寄せ）」の表示（紹介ブロックとヘッダーのリンク）。再開するときは true に戻す */
  showSakeSection: false,
} as const;

/**
 * 予約サイトのURL。掲載が決まったら差し替える。
 * 空文字のあいだはボタンを「準備中」として表示する。
 */
export const otaLinks = [
  // airbnb.com にしておくと、見る人の言語・地域に合わせて Airbnb 側で表示が切り替わる
  { name: "Airbnb", url: "https://www.airbnb.com/rooms/1783038141289534759", icon: "home" },
  { name: "楽天トラベル", url: "", icon: "suitcase" },
  { name: "じゃらん", url: "", icon: "pin" },
] as const;

/**
 * 写真（Google Drive の sayozuki_01〜09.jpg）。
 * null の枠は表示しない。料理・周辺風景は撮影後に追加する。
 * 08（外観）は看板が旧名「静山荘」のため未使用。02 は 04 の縮小版なので未使用。
 */
export const photos = {
  hero: "/images/sayozuki_04.jpg",
  lobby: "/images/sayozuki_07.jpg",
  noren: "/images/sayozuki_05.jpg",
  onsen: "/images/sayozuki_03.jpg",
  room: "/images/sayozuki_09.jpg",
  corridor: "/images/sayozuki_06.jpg",
  meal: null as string | null,
};

export const onsen = {
  quality: "ナトリウム・カルシウム塩化物・硫酸塩温泉",
  benefits: [
    "神経痛",
    "筋肉痛",
    "関節痛",
    "五十肩",
    "冷え性",
    "打ち身",
    "くじき",
    "切り傷",
    "やけど",
    "皮膚病",
    "痔",
    "動脈硬化",
    "婦人病",
    "消化器病",
  ],
};

export type Room = {
  name: string;
  /** 素泊まり・2名利用時の1室料金（税込） */
  price: number;
  capacity: number;
  note?: string;
};

export const rooms: Room[] = [
  { name: "201号室", price: 14000, capacity: 5, note: "ご家族・グループに" },
  { name: "蔵王", price: 13500, capacity: 4 },
  { name: "月山", price: 13500, capacity: 4 },
  { name: "301号室", price: 13500, capacity: 4 },
  { name: "302号室", price: 11000, capacity: 2 },
  { name: "304号室", price: 10000, capacity: 2 },
];

/** お食事の追加料金（お一人様） */
export const meals = {
  breakfast: 1000,
  dinner: 3500,
};

/**
 * HPの予約（事前決済）の料金の決まり。lib/pricing.ts が使う。
 * - 3名様以上：1名ごとに、その部屋の2名料金の半分を足す（Notion「室料＋素泊まり販売価格の1名料金」）
 * - 繁忙期：下の期間の夜は 1室1泊 busySurcharge を足す（期間は始まりと終わりを含む。毎年同じ月日）
 * - 入湯税（大人1人1泊300円）は事前決済に含めず、現地でいただく
 */
export const bookingRules = {
  baseGuests: 2,
  busySurcharge: 3000,
  /** 月日（MM-DD）。年をまたぐ期間は from > to で書く */
  busySeasons: [
    { label: "年末年始", from: "12-29", to: "01-03" },
    { label: "ゴールデンウィーク", from: "04-29", to: "05-05" },
    { label: "お盆", from: "08-11", to: "08-16" },
  ],
  /** 予約できる泊数の上限 */
  maxNights: 14,
  /** 何日先まで予約を受けるか（予約管理の空室は180日先まで） */
  bookAheadDays: 180,
  /** 入湯税（大人1人1泊）。現地払い */
  bathTax: 300,
  /**
   * 公式サイト（HPの事前決済）限定の割引（%）。室料だけに掛け、食事・入湯税は対象外。
   * 「他の予約サイトより最安値」とうたうので、OTA の料金は lib/site.ts の rooms の定価より下げないこと
   */
  directDiscount: 10,
};

/** 公式サイト価格（室料の定価から directDiscount を引いた額） */
export const directPrice = (list: number) => list - Math.round((list * bookingRules.directDiscount) / 100);

/**
 * キャンセル料（事前決済の予約）。日数はご到着日の何日前か。上から順に当てはめる。
 * 画面と確認メールの文言は lib/i18n の book.policy。ここを変えたら6言語とも直す
 */
export const cancellationPolicy = [
  { daysBefore: 7, rate: 0 },
  { daysBefore: 2, rate: 30 },
  { daysBefore: 1, rate: 50 },
  { daysBefore: 0, rate: 100 },
] as const;

export const pricingNotes = [
  "表示は素泊まり・2名様でご利用の場合の1室料金です。",
  "3名様以上でのご利用は、1名様分の素泊まり料金を加算いたします。",
  "繁忙期は1室3,000円〜の加算となります。",
];

/**
 * 滞在中のご案内（/guide）で使う運用情報。
 * null のあいだは各ページに「準備中」と出る。決まったら時刻を "15:00" のように入れる。
 */
export const stay = {
  checkIn: "15:00" as string | null,
  checkOut: "10:00" as string | null,
  /** 大浴場を使える時間。"24h" = 24時間いつでも。時間を区切るときは { from: "15:00", to: "24:00" } */
  bathHours: "24h" as "24h" | { from: string; to: string } | null,
  /** 駐車場の案内（例 "無料・6台"）。未確認のあいだは null */
  parking: null as string | null,
  /** 入湯税（上山市・大人1人1泊、円）。フロントで徴収。予約台帳（booking/）と客室オーダーの BATH_TAX_YEN も同じ額に */
  bathTaxYen: 300,
  /** 泉質の正式表記と源泉（温泉分析書より） */
  onsenFull: "ナトリウム・カルシウム－塩化物・硫酸塩温泉（低張性弱アルカリ性高温泉）",
  onsenSources: ["葉山地区1号源泉", "葉山地区2号源泉"],
  /** 客室オーダーの受付時間。order/wrangler.jsonc の ORDER_OPEN・LAST_ORDER と合わせる */
  roomOrder: { open: "6:00", lastOrder: "22:30" }, // 夕食・朝食は事前予約制で、客室オーダーでは受けない
};

/** 国内表記の番号を国際表記（+81-23-…）にする。外国語のページと tel: リンク用 */
export const intlPhone = (n: string) => `+81-${n.replace(/^0/, "")}`;
export const telHref = (n: string) => `tel:+81${n.replace(/^0/, "").replace(/-/g, "")}`;

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
