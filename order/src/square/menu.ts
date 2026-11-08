import type { Env } from '../env';
import { CATEGORIES, ITEMS } from '../config/i18n-menu';
import { sq } from './client';
import type { Tr } from '../config/i18n-menu';
import type { Menu, MenuItem } from './types';

export interface MenuMeta {
  names: Tr | null;
  descs: Tr | null;
  paused: boolean;
}

/** スタッフ画面で入れた訳と一時停止（D1）。表がまだ無い環境でも止まらないように空で返す */
export async function loadMenuMeta(env: Env): Promise<Map<string, MenuMeta>> {
  try {
    const r = await env.DB.prepare('SELECT item_id, names, descs, paused FROM menu_meta').all<{ item_id: string; names: string | null; descs: string | null; paused: number }>();
    return new Map(
      (r.results ?? []).map((x) => [x.item_id, { names: x.names ? JSON.parse(x.names) : null, descs: x.descs ? JSON.parse(x.descs) : null, paused: Boolean(x.paused) }])
    );
  } catch (e) {
    console.error('menu_meta', e);
    return new Map();
  }
}

/** Squareのカタログ＋在庫から、売り切れ判定込みのメニューを組み立てる */
export async function fetchSquareMenu(env: Env): Promise<Menu> {
  const objects: any[] = [];
  let cursor: string | undefined;
  do {
    const q = new URLSearchParams({ types: 'ITEM,CATEGORY,IMAGE' });
    if (cursor) q.set('cursor', cursor);
    const r = await sq<{ objects?: any[]; cursor?: string }>(env, `/v2/catalog/list?${q}`);
    objects.push(...(r.objects ?? []));
    cursor = r.cursor;
  } while (cursor);

  const images = new Map<string, string>();
  const categories = new Map<string, string>();
  for (const o of objects) {
    if (o.type === 'IMAGE' && o.image_data?.url) images.set(o.id, o.image_data.url);
    if (o.type === 'CATEGORY' && o.category_data?.name) categories.set(o.id, o.category_data.name);
  }

  const meta = await loadMenuMeta(env);
  const loc = env.SQUARE_LOCATION_ID;
  const items: MenuItem[] = [];
  for (const o of objects) {
    if (o.type !== 'ITEM' || o.is_deleted) continue;
    const d = o.item_data ?? {};
    if (d.is_archived) continue;
    if (!availableAt(o, loc)) continue;
    const catId: string | undefined = d.categories?.[0]?.id ?? d.reporting_category?.id ?? d.category_id;
    const category = catId ? categories.get(catId) : undefined;
    if (!category || !CATEGORIES[category]) continue; // 注文画面のカテゴリに属するものだけ出す
    const v = (d.variations ?? []).find((x: any) => !x.is_deleted && availableAt(x, loc));
    if (!v) continue;
    const vd = v.item_variation_data ?? {};
    const price = Number(vd.price_money?.amount ?? 0);
    const ov = (vd.location_overrides ?? []).find((x: any) => x.location_id === loc) ?? {};
    const tracked = Boolean(ov.track_inventory ?? vd.track_inventory);
    const name: string = d.name;
    const tr = ITEMS[name];
    const m = meta.get(o.id);
    const imageIds: string[] = (d.image_ids ?? []).filter((id: string) => images.has(id));
    items.push({
      id: v.id,
      itemId: o.id,
      name,
      names: m?.names ?? tr?.name ?? {},
      desc: d.description_plaintext ?? d.description ?? '',
      descs: m?.descs ?? tr?.desc ?? {},
      price,
      category,
      tracked,
      stock: null,
      // 数を数えている商品は残り数で判断する（Square側の「売り切れ」表示は数を足しても残ることがあるため見ない）
      soldOut: (!tracked && Boolean(ov.sold_out)) || Boolean(m?.paused),
      paused: Boolean(m?.paused),
      images: imageIds.map((id) => images.get(id)!),
      imageIds
    });
  }

  const trackedIds = items.filter((i) => i.tracked).map((i) => i.id);
  if (trackedIds.length) {
    const counts = await batchCounts(env, trackedIds);
    for (const i of items) if (i.tracked) i.stock = counts.get(i.id) ?? 0;
  }

  return { fetchedAt: Date.now(), items, categories: categoryList() };
}

async function batchCounts(env: Env, ids: string[]) {
  const map = new Map<string, number>();
  let cursor: string | undefined;
  do {
    const r = await sq<{ counts?: any[]; cursor?: string }>(env, '/v2/inventory/counts/batch-retrieve', {
      body: { catalog_object_ids: ids, location_ids: [env.SQUARE_LOCATION_ID], states: ['IN_STOCK'], cursor }
    });
    for (const c of r.counts ?? []) map.set(c.catalog_object_id, Math.floor(Number(c.quantity)));
    cursor = r.cursor;
  } while (cursor);
  return map;
}

const availableAt = (o: any, loc: string) => {
  if (o.present_at_all_locations === false) return (o.present_at_location_ids ?? []).includes(loc);
  return !(o.absent_at_location_ids ?? []).includes(loc);
};

export const categoryList = () =>
  Object.entries(CATEGORIES)
    .map(([name, c]) => ({ name, names: c.names, order: c.order, cutoff: c.cutoff, preorder: Boolean(c.preorder) }))
    .sort((a, b) => a.order - b.order);
