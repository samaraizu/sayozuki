import { en } from "./en";
import { ja, type Dict } from "./ja";
import { ko } from "./ko";
import { th } from "./th";
import { vi } from "./vi";
import { zh } from "./zh";

/** 日本語は / 、それ以外は /en などのパスで出す */
export const dictionaries = { ja, en, zh, vi, th, ko } satisfies Record<string, Dict>;

export type Locale = keyof typeof dictionaries;
export const locales = Object.keys(dictionaries) as Locale[];
export const foreignLocales = locales.filter((l) => l !== "ja");

export const isLocale = (s: string): s is Locale => s in dictionaries;

/** <html lang> に入れる値 */
export const htmlLang: Record<Locale, string> = {
  ja: "ja",
  en: "en",
  zh: "zh-Hans",
  vi: "vi",
  th: "th",
  ko: "ko",
};

export const pathFor = (l: Locale) => (l === "ja" ? "/" : `/${l}`);

/** hreflang。検索エンジンに各言語版の場所を伝える */
export const languageAlternates = Object.fromEntries([
  ...locales.map((l) => [htmlLang[l], pathFor(l)]),
  ["x-default", "/"],
]);

/** "{n}名" の {n} などを差し込む */
export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** 日本語は「14,000円」、他は「¥14,000」 */
export const formatYen = (l: Locale, n: number) =>
  l === "ja" ? `${n.toLocaleString("ja-JP")}円` : `¥${n.toLocaleString("en-US")}`;

export type { Dict };
