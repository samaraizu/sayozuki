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
  // Notion では「営業日数22日・水〜日あたり」。確定したら書き換える
  openDays: "水曜日〜日曜日を中心に営業しております",
  // Google ビジネスプロフィール（現在の登録名は「旅館 静山荘 次元ブレッド」）
  gbpUrl: "https://share.google/ZoLhpDujEC7RIG0Xq",
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

export const pricingNotes = [
  "表示は素泊まり・2名様でご利用の場合の1室料金です。",
  "3名様以上でのご利用は、1名様分の素泊まり料金を加算いたします。",
  "繁忙期は1室3,000円〜の加算となります。",
];

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
