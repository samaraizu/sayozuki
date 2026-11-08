import type { Env } from '../env';
import { isMock } from '../env';
import { CATEGORIES, type Tr } from '../config/i18n-menu';
import { nowIso } from '../lib/time';
import { translate } from '../lib/translate';
import { HttpError } from '../lib/util';
import { sq, sqUpload } from './client';
import { mockItems, saveMockItems } from './mock';

/**
 * スタッフ画面からのメニュー編集。商品そのもの（名前・説明・価格・カテゴリ・写真・在庫）は Square のカタログに書き、
 * Square に持てない4言語の訳と「一時停止」は D1 の menu_meta に置く。
 * 削除は Square の「アーカイブ」（Squareの管理画面から戻せる。過去の注文・売上の記録も残る）。
 */

export interface SaveInput {
  name: string;
  desc: string;
  price: number;
  category: string;
  tracked: boolean;
  /** 在庫を数える商品の、いまの数。null なら数を変えない */
  stock: number | null;
  paused: boolean;
  names: Tr;
  descs: Tr;
}

const TR_LANGS = ['en', 'zht', 'zhs', 'ko'] as const;

const cleanTr = (v: unknown): Tr => {
  const out: Tr = {};
  if (v && typeof v === 'object')
    for (const l of TR_LANGS) {
      const s = String((v as Record<string, unknown>)[l] ?? '').trim();
      if (s) out[l] = s.slice(0, 300);
    }
  return out;
};

export function parseInput(body: any): SaveInput {
  const name = String(body?.name ?? '').trim();
  const desc = String(body?.desc ?? '').replace(/\r\n?/g, '\n').trim();
  const price = Number(body?.price);
  const category = String(body?.category ?? '');
  const tracked = Boolean(body?.tracked);
  const stockRaw = body?.stock;
  const stock = stockRaw === null || stockRaw === undefined || stockRaw === '' ? null : Number(stockRaw);
  if (!name) throw new HttpError(400, 'name_required');
  if (name.length > 60) throw new HttpError(400, 'name_too_long');
  if (desc.length > 300) throw new HttpError(400, 'desc_too_long');
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) throw new HttpError(400, 'bad_price');
  if (!CATEGORIES[category]) throw new HttpError(400, 'bad_category');
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 9999)) throw new HttpError(400, 'bad_stock');
  return { name, desc, price, category, tracked, stock, paused: Boolean(body?.paused), names: cleanTr(body?.names), descs: cleanTr(body?.descs) };
}

/** 空いている言語だけ日本語から自動で訳す（スタッフが直した訳はそのまま） */
async function fillTr(env: Env, ja: string, given: Tr): Promise<Tr> {
  const out: Tr = { ...given };
  if (!ja) return {};
  let zh: string | null | undefined;
  for (const l of TR_LANGS) {
    if (out[l]) continue;
    if (l === 'zht' || l === 'zhs') {
      if (zh === undefined) zh = await translate(env, ja, 'ja', 'zhs');
      if (zh) out[l] = zh;
    } else {
      const t = await translate(env, ja, 'ja', l);
      if (t) out[l] = t;
    }
  }
  return out;
}

/** 日本語から4言語に訳した案（スタッフ画面の「訳し直す」用） */
export async function suggestTr(env: Env, name: string, desc: string) {
  return { names: await fillTr(env, name.trim(), {}), descs: await fillTr(env, desc.trim(), {}) };
}

async function saveMeta(env: Env, itemId: string, input: SaveInput) {
  const names = await fillTr(env, input.name, input.names);
  const descs = await fillTr(env, input.desc, input.descs);
  await env.DB.prepare(
    `INSERT INTO menu_meta (item_id, names, descs, paused, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET names = excluded.names, descs = excluded.descs, paused = excluded.paused, updated_at = excluded.updated_at`
  )
    .bind(itemId, JSON.stringify(names), JSON.stringify(descs), input.paused ? 1 : 0, nowIso())
    .run();
}

/** 精算前の注文に入っている商品か（価格を変えると、精算時のSquareの請求額が画面の明細とずれるため止める） */
async function inOpenOrders(env: Env, variationId: string) {
  const r = await env.DB.prepare(
    `SELECT 1 AS x FROM order_lines l
       JOIN orders o ON o.id = l.order_id
       LEFT JOIN settlements st ON st.id = o.settlement_id
      WHERE l.variation_id = ? AND o.status != 'canceled' AND (o.settlement_id IS NULL OR st.status = 'pending')
      LIMIT 1`
  )
    .bind(variationId)
    .first();
  return Boolean(r);
}

/** 精算前の注文で押さえている数（在庫を数える商品のみ） */
export async function heldCounts(env: Env) {
  const r = await env.DB.prepare(
    `SELECT l.variation_id AS id, SUM(l.qty) AS qty
       FROM order_lines l
       JOIN orders o ON o.id = l.order_id
       LEFT JOIN settlements st ON st.id = o.settlement_id
      WHERE l.tracked = 1 AND o.status != 'canceled' AND (o.settlement_id IS NULL OR st.status = 'pending')
      GROUP BY l.variation_id`
  ).all<{ id: string; qty: number }>();
  return Object.fromEntries((r.results ?? []).map((x) => [x.id, Number(x.qty)]));
}

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const descHtml = (s: string) => (s ? `<p>${escHtml(s).replace(/\n/g, '<br>')}</p>` : '');

async function categoryIds(env: Env) {
  const map = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const q = new URLSearchParams({ types: 'CATEGORY' });
    if (cursor) q.set('cursor', cursor);
    const r = await sq<{ objects?: any[]; cursor?: string }>(env, `/v2/catalog/list?${q}`);
    for (const o of r.objects ?? []) if (!o.is_deleted && o.category_data?.name) map.set(o.category_data.name, o.id);
    cursor = r.cursor;
  } while (cursor);
  return map;
}

async function getItem(env: Env, itemId: string) {
  const r = await sq<{ object?: any }>(env, `/v2/catalog/object/${encodeURIComponent(itemId)}`);
  const o = r.object;
  if (!o || o.type !== 'ITEM' || o.is_deleted) throw new HttpError(404, 'item_not_found');
  const v = (o.item_data?.variations ?? []).find((x: any) => !x.is_deleted);
  if (!v) throw new HttpError(409, 'no_variation');
  return { o, v };
}

const upsert = (env: Env, object: unknown) =>
  sq<{ catalog_object: any }>(env, '/v2/catalog/object', { body: { idempotency_key: crypto.randomUUID(), object } });

/** 注文画面のカテゴリをSquareから引く。まだSquareに無ければ作る（「その他」などを足したとき、管理画面で作る手間をなくす） */
async function categoryId(env: Env, name: string) {
  const found = (await categoryIds(env)).get(name);
  if (found) return found;
  const r = await upsert(env, { type: 'CATEGORY', id: '#category', category_data: { name } });
  return r.catalog_object.id as string;
}

async function setStock(env: Env, variationId: string, n: number) {
  await sq(env, '/v2/inventory/changes/batch-create', {
    body: {
      idempotency_key: crypto.randomUUID(),
      ignore_unchanged_counts: true,
      changes: [
        {
          type: 'PHYSICAL_COUNT',
          physical_count: {
            catalog_object_id: variationId,
            state: 'IN_STOCK',
            location_id: env.SQUARE_LOCATION_ID,
            quantity: String(n),
            occurred_at: new Date().toISOString()
          }
        }
      ]
    }
  });
}

function applyFields(o: any, v: any, input: SaveInput, catId: string, loc: string) {
  const d = o.item_data;
  d.name = input.name;
  // description は旧項目。description_html に一本化する（両方送ると食い違うため）
  delete d.description;
  delete d.description_plaintext;
  d.description_html = descHtml(input.desc);
  d.categories = [{ id: catId }];
  d.reporting_category = { id: catId };
  const vd = v.item_variation_data;
  vd.pricing_type = 'FIXED_PRICING';
  vd.price_money = { amount: input.price, currency: 'JPY' };
  vd.track_inventory = input.tracked;
  // 店舗ごとの上書きが残っていると全体の設定が効かないので外す（sold_out などは読み取り専用）
  for (const ov of vd.location_overrides ?? []) if (ov.location_id === loc) delete ov.track_inventory;
}

export async function createItem(env: Env, input: SaveInput) {
  if (isMock(env)) {
    const items = await mockItems(env);
    const n = Date.now().toString(36);
    items.push({ itemId: `MOCKITEM_${n}`, varId: `MOCKVAR_${n}`, name: input.name, desc: input.desc, price: input.price, category: input.category, tracked: input.tracked, stock: input.tracked ? (input.stock ?? 0) : null, soldOut: false, images: [] });
    await saveMockItems(env, items);
    await saveMeta(env, `MOCKITEM_${n}`, input);
    return `MOCKITEM_${n}`;
  }
  const catId = await categoryId(env, input.category);
  const o: any = {
    type: 'ITEM',
    id: '#item',
    present_at_all_locations: true,
    item_data: {
      product_type: 'REGULAR',
      is_taxable: true,
      variations: [
        {
          type: 'ITEM_VARIATION',
          id: '#variation',
          present_at_all_locations: true,
          item_variation_data: { item_id: '#item', name: '通常', sellable: true, stockable: true }
        }
      ]
    }
  };
  applyFields(o, o.item_data.variations[0], input, catId, env.SQUARE_LOCATION_ID);
  const r = await upsert(env, o);
  const item = r.catalog_object;
  const varId = item.item_data.variations[0].id;
  if (input.tracked) await setStock(env, varId, input.stock ?? 0);
  await saveMeta(env, item.id, input);
  return item.id as string;
}

export async function updateItem(env: Env, itemId: string, input: SaveInput) {
  if (isMock(env)) {
    const items = await mockItems(env);
    const x = items.find((i) => i.itemId === itemId && !i.archived);
    if (!x) throw new HttpError(404, 'item_not_found');
    if (x.price !== input.price && (await inOpenOrders(env, x.varId))) throw new HttpError(409, 'price_locked');
    Object.assign(x, { name: input.name, desc: input.desc, price: input.price, category: input.category, tracked: input.tracked });
    if (input.tracked && input.stock !== null) x.stock = input.stock;
    if (!input.tracked) x.stock = null;
    await saveMockItems(env, items);
    await saveMeta(env, itemId, input);
    return;
  }
  const { o, v } = await getItem(env, itemId);
  const before = Number(v.item_variation_data?.price_money?.amount ?? 0);
  if (before !== input.price && (await inOpenOrders(env, v.id))) throw new HttpError(409, 'price_locked');
  const catId = await categoryId(env, input.category);
  applyFields(o, v, input, catId, env.SQUARE_LOCATION_ID);
  await upsert(env, o);
  if (input.tracked && input.stock !== null) await setStock(env, v.id, input.stock);
  await saveMeta(env, itemId, input);
}

/** 掲載をやめる（Squareではアーカイブ。精算前の注文に入っている間はできない） */
export async function archiveItem(env: Env, itemId: string) {
  if (isMock(env)) {
    const items = await mockItems(env);
    const x = items.find((i) => i.itemId === itemId && !i.archived);
    if (!x) throw new HttpError(404, 'item_not_found');
    if (await inOpenOrders(env, x.varId)) throw new HttpError(409, 'item_in_use');
    x.archived = true;
    return saveMockItems(env, items);
  }
  const { o, v } = await getItem(env, itemId);
  if (await inOpenOrders(env, v.id)) throw new HttpError(409, 'item_in_use');
  o.item_data.is_archived = true;
  await upsert(env, o);
}

export async function addImage(env: Env, itemId: string, file: Blob) {
  if (!/^image\/(jpeg|png|gif)$/.test(file.type)) throw new HttpError(400, 'bad_image');
  if (file.size > 10 * 1024 * 1024) throw new HttpError(400, 'image_too_large');
  if (isMock(env)) {
    const items = await mockItems(env);
    const x = items.find((i) => i.itemId === itemId);
    if (!x) throw new HttpError(404, 'item_not_found');
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (const c of buf) bin += String.fromCharCode(c);
    x.images.push({ id: `MOCKIMG_${Date.now().toString(36)}`, url: `data:${file.type};base64,${btoa(bin)}` });
    return saveMockItems(env, items);
  }
  await getItem(env, itemId);
  await sqUpload(
    env,
    '/v2/catalog/images',
    { idempotency_key: crypto.randomUUID(), object_id: itemId, is_primary: false, image: { type: 'IMAGE', id: '#image', image_data: { name: 'photo' } } },
    file,
    file.type === 'image/png' ? 'photo.png' : file.type === 'image/gif' ? 'photo.gif' : 'photo.jpg'
  );
}

/** 写真を外す（first = true なら外さずに1枚目＝一覧のサムネにする） */
export async function changeImage(env: Env, itemId: string, imageId: string, op: 'remove' | 'first') {
  if (isMock(env)) {
    const items = await mockItems(env);
    const x = items.find((i) => i.itemId === itemId);
    if (!x) throw new HttpError(404, 'item_not_found');
    const img = x.images.find((i) => i.id === imageId);
    if (!img) throw new HttpError(404, 'image_not_found');
    x.images = op === 'remove' ? x.images.filter((i) => i !== img) : [img, ...x.images.filter((i) => i !== img)];
    return saveMockItems(env, items);
  }
  const { o } = await getItem(env, itemId);
  const ids: string[] = o.item_data.image_ids ?? [];
  if (!ids.includes(imageId)) throw new HttpError(404, 'image_not_found');
  o.item_data.image_ids = op === 'remove' ? ids.filter((i) => i !== imageId) : [imageId, ...ids.filter((i) => i !== imageId)];
  await upsert(env, o);
  if (op === 'remove')
    await sq(env, `/v2/catalog/object/${encodeURIComponent(imageId)}`, { method: 'DELETE' }).catch((e) => console.error('image delete failed', e));
}
