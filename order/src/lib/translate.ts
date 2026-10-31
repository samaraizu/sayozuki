import type { Env } from '../env';

/** 画面の言語ID → 翻訳モデル（m2m100）の言語。繁体字・簡体字はどちらも中国語として訳す */
const CODE: Record<string, string> = { ja: 'ja', en: 'en', zht: 'zh', zhs: 'zh', ko: 'ko' };
const NAME: Record<string, string> = { ja: 'japanese', en: 'english', zh: 'chinese', ko: 'korean' };

export const CHAT_LANGS = Object.keys(CODE);

/**
 * Workers AI で訳す。訳す必要がないとき・失敗したときは null（原文のまま表示する）。
 * モデルのドキュメントに言語コード（ja）と言語名（japanese）の両方の例があるため、コード → 名前の順に試す。
 */
export async function translate(env: Env, text: string, from: string, to: string): Promise<string | null> {
  const s = CODE[from];
  const d = CODE[to];
  if (!s || !d || s === d || !env.AI) return null;
  for (const [a, b] of [
    [s, d],
    [NAME[s], NAME[d]]
  ]) {
    try {
      const r = (await env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang: a, target_lang: b })) as { translated_text?: string };
      const out = r?.translated_text?.trim();
      if (out && out !== text.trim()) return out;
    } catch (e) {
      console.error('translate failed', a, b, e);
    }
  }
  return null;
}
