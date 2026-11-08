import type { Env } from '../env';
import { ITEMS } from '../config/i18n-menu';
import { categoryList, loadMenuMeta } from './menu';
import type { Menu, MenuItem } from './types';

/** Square未接続でも画面と流れを確認できるモックのカタログ（価格は動作確認用のダミーで、実際の料金ではない） */
const RAW: [string, string, string, number, number | null, boolean?][] = [
  ['山形牛すき焼き', '夕食', '2人前・〆の讃岐うどん付き', 12000, 2],
  ['お造り盛り合わせ', '夕食', '2人前', 3800, 0],
  ['芋煮と山形の夕膳', '夕食', '1人前', 4500, null],
  ['クロワッサンサンドの朝食', '朝食', '1人前・お飲み物付き', 1000, null],
  ['おにぎりと漬物の朝食', '朝食', '1人前・お飲み物付き', 1000, null],
  ['紅干し柿', 'お菓子', '2個・お茶つき', 600, null],
  ['のし梅', 'お菓子', '2枚', 500, null],
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

export interface MockItem {
  itemId: string;
  varId: string;
  name: string;
  desc: string;
  price: number;
  category: string;
  tracked: boolean;
  stock: number | null;
  soldOut: boolean;
  images: { id: string; url: string }[];
  archived?: boolean;
}

const defaults = (): MockItem[] =>
  RAW.map(([name, category, desc, price, stock, soldOut], i) => ({
    itemId: `MOCKITEM${i}`,
    varId: `MOCKVAR${i}`,
    name,
    desc,
    price,
    category,
    tracked: stock !== null,
    stock,
    soldOut: Boolean(soldOut),
    images: []
  }));

/** モックのカタログ。スタッフ画面での編集を試せるよう D1 の settings に置く（ローカル専用） */
export async function mockItems(env: Env): Promise<MockItem[]> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'mock_menu'").first<{ value: string }>();
  return row ? JSON.parse(row.value) : defaults();
}

export async function saveMockItems(env: Env, items: MockItem[]) {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('mock_menu', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(JSON.stringify(items))
    .run();
}

export async function mockMenu(env: Env): Promise<Menu> {
  const meta = await loadMenuMeta(env);
  const items: MenuItem[] = (await mockItems(env))
    .filter((x) => !x.archived)
    .map((x) => {
      const m = meta.get(x.itemId);
      return {
        id: x.varId,
        itemId: x.itemId,
        name: x.name,
        names: m?.names ?? ITEMS[x.name]?.name ?? {},
        desc: x.desc,
        descs: m?.descs ?? ITEMS[x.name]?.desc ?? {},
        price: x.price,
        category: x.category,
        tracked: x.tracked,
        stock: x.tracked ? (x.stock ?? 0) : null,
        soldOut: (!x.tracked && x.soldOut) || Boolean(m?.paused),
        paused: Boolean(m?.paused),
        images: x.images.map((i) => i.url),
        imageIds: x.images.map((i) => i.id)
      };
    });
  return { fetchedAt: Date.now(), items, categories: categoryList() };
}
