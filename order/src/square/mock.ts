import { ITEMS } from '../config/i18n-menu';
import { categoryList } from './menu';
import type { Menu, MenuItem } from './types';

/** Square未接続でも画面と流れを確認できるモックのカタログ（価格は動作確認用のダミーで、実際の料金ではない） */
const RAW: [string, string, string, number, number | null, boolean?][] = [
  ['山形牛すき焼き', '夕食', '2人前', 12000, 2],
  ['お造り盛り合わせ', '夕食', '2人前', 3800, 0],
  ['塩むすび', '夜食', '2個・漬物つき', 600, null],
  ['玉子サンドウィッチ', '夜食', '4切れ', 900, null],
  ['カップラーメン', '夜食', 'お湯をお持ちします', 400, null, true],
  ['地酒 一合', '飲み物', '冷 / ぬる燗', 1100, null],
  ['瓶ビール 中瓶', '飲み物', 'グラス2つ', 700, null],
  ['ラ・フランスジュース', '飲み物', '山形産', 600, null],
  ['天然水', '飲み物', '500ml', 250, null],
  ['緑茶', '飲み物', '500ml', 200, null],
  ['翌朝のコーヒー', '翌朝', '起床時間に扉前へ', 500, null],
  ['レイトチェックアウト', '翌朝', '12時まで延長', 3000, 1]
];

export function mockMenu(): Menu {
  const items: MenuItem[] = RAW.map(([name, category, desc, price, stock, soldOut], i) => ({
    id: `MOCKVAR${i}`,
    itemId: `MOCKITEM${i}`,
    name,
    names: ITEMS[name]?.name ?? {},
    desc,
    descs: ITEMS[name]?.desc ?? {},
    price,
    category,
    tracked: stock !== null,
    stock,
    soldOut: Boolean(soldOut) || stock === 0,
    images: []
  }));
  return { fetchedAt: Date.now(), items, categories: categoryList() };
}
