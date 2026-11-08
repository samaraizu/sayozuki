import type { Env } from '../env';
import { translate } from '../lib/translate';
import { HttpError } from '../lib/util';

/**
 * 商品の詳細ページ（お客様が商品をタップしたときのモーダルと /menu/<slug>）の読み物。
 * スタッフ画面の「メニュー」→ 商品の編集で入れる。日本語と英語だけ持ち、英語の空欄は保存のときに日本語から訳す
 * （繁体字・簡体字・韓国語の画面では英語で出す）。写真は Square の商品写真をそのまま使う。
 * D1 の settings に `menu_detail:<SquareのITEMのid>` で置く（客室オーダーのデプロイは表を作り替えないので、新しい表や列を足さない）
 */
export type Tr2 = { ja?: string; en?: string };
export interface MenuDetail {
  slug: string;
  kicker: Tr2;
  story: Tr2;
  contents: { ja: string[]; en: string[] };
  serve: Tr2;
  portion: Tr2;
  note: Tr2;
  allergens: string[];
}

/** public/dishes.js の ALLERGENS と同じキー */
export const ALLERGEN_KEYS = ['egg', 'milk', 'wheat', 'shrimp', 'crab', 'soba', 'peanut', 'walnut', 'soy', 'beef', 'pork', 'fish', 'sesame', 'alcohol'];
const KEY = 'menu_detail:';
const LIMIT = { kicker: 60, story: 600, serve: 60, portion: 30, note: 200 } as const;
const TEXT_FIELDS = Object.keys(LIMIT) as (keyof typeof LIMIT)[];

const str = (v: unknown, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const lines = (v: unknown) =>
  (Array.isArray(v) ? v : String(v ?? '').split('\n')).map((x) => str(x, 80)).filter(Boolean).slice(0, 12);

/** スタッフ画面から来た値を整える。null なら詳細ページを作らない */
export function parseDetail(v: any): MenuDetail | null {
  if (!v || typeof v !== 'object') return null;
  const slug = String(v.slug ?? '').trim().toLowerCase();
  if (slug && !/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug)) throw new HttpError(400, 'bad_slug');
  const d: MenuDetail = {
    slug,
    kicker: {},
    story: {},
    contents: { ja: lines(v.contents?.ja), en: lines(v.contents?.en) },
    serve: {},
    portion: {},
    note: {},
    allergens: Array.isArray(v.allergens) ? [...new Set<string>(v.allergens.map(String))].filter((a) => ALLERGEN_KEYS.includes(a)) : []
  };
  for (const f of TEXT_FIELDS) for (const l of ['ja', 'en'] as const) {
    const s = str(v[f]?.[l], LIMIT[f]);
    if (s) d[f][l] = s;
  }
  return d;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

export async function loadDetails(env: Env): Promise<Map<string, MenuDetail>> {
  try {
    const r = await env.DB.prepare('SELECT key, value FROM settings WHERE key LIKE ?').bind(KEY + '%').all<{ key: string; value: string }>();
    return new Map((r.results ?? []).map((x) => [x.key.slice(KEY.length), JSON.parse(x.value) as MenuDetail]));
  } catch (e) {
    console.error('menu_detail', e);
    return new Map();
  }
}

/** Square に書く前に、URL がほかの商品と重なっていないか確かめる（itemId は新規なら null） */
export async function assertSlugFree(env: Env, itemId: string | null, detail: MenuDetail | null) {
  if (!detail?.slug) return;
  for (const [id, d] of await loadDetails(env)) if (id !== itemId && d.slug === detail.slug) throw new HttpError(409, 'slug_taken');
}

/** 保存。英語の空欄を訳し、URL が空なら英語名から作る（ほかの商品と重なれば -2 を付ける） */
export async function saveDetail(env: Env, itemId: string, detail: MenuDetail | null, nameEn: string) {
  if (!detail) {
    await env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(KEY + itemId).run();
    return;
  }
  const others = new Set([...(await loadDetails(env))].filter(([id]) => id !== itemId).map(([, d]) => d.slug));
  if (detail.slug && others.has(detail.slug)) throw new HttpError(409, 'slug_taken');
  if (!detail.slug) {
    const base = slugify(nameEn) || 'item-' + itemId.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, '');
    let s = base;
    for (let n = 2; others.has(s); n++) s = `${base}-${n}`;
    detail.slug = s;
  }
  for (const f of TEXT_FIELDS) {
    const ja = detail[f].ja;
    if (ja && !detail[f].en) detail[f].en = (await translate(env, ja, 'ja', 'en')) ?? undefined;
  }
  if (!detail.contents.en.length && detail.contents.ja.length) {
    const out: string[] = [];
    for (const l of detail.contents.ja) out.push((await translate(env, l, 'ja', 'en')) ?? l);
    detail.contents.en = out;
  }
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(KEY + itemId, JSON.stringify(detail))
    .run();
}
