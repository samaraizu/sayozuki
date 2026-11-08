// /menu の共通部分（言語の決め方・ヘッダー・公開メニューの読み込み）
import { LANGS } from './i18n.js';
import { pickD } from './dishes.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const yen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');

export function initialLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && LANGS.some((l) => l.id === q)) return q;
  try { const s = localStorage.getItem('syz_lang'); if (s) return s; } catch {}
  const n = (navigator.language || 'ja').toLowerCase();
  if (n.startsWith('ja')) return 'ja';
  if (n.startsWith('ko')) return 'ko';
  if (n.startsWith('zh')) return /tw|hk|hant/.test(n) ? 'zht' : 'zhs';
  return 'en';
}

export function setLang(id) {
  try { localStorage.setItem('syz_lang', id); } catch {}
  const u = new URL(location.href);
  u.searchParams.set('lang', id);
  history.replaceState(history.state, '', u);
  const l = LANGS.find((x) => x.id === id) || LANGS[0];
  document.documentElement.lang = l.code;
  if (l.font && !document.getElementById('font-' + l.font)) {
    const k = document.createElement('link');
    k.id = 'font-' + l.font;
    k.rel = 'stylesheet';
    k.href = `https://fonts.googleapis.com/css2?family=${l.font}:wght@400;500;700&display=swap`;
    document.head.appendChild(k);
  }
}

const moon = '<svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true"><path d="M17 3a10 10 0 1 0 6 17A11 11 0 0 1 17 3z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

export function pageHeader(lang, home = '/menu') {
  return `<header class="pg-head"><a href="${home}?lang=${lang}">${moon}<span class="brand-name"><span class="brand-ja">小夜月</span><span class="brand-en" lang="en">Sayozuki</span></span></a>
    <div class="pg-langs">${LANGS.map((l) => `<button data-act="lang" data-id="${l.id}" lang="${l.code}" aria-pressed="${l.id === lang}">${l.short}</button>`).join('')}</div></header>`;
}

/** Squareの名前・価格・写真・詳細ページ（{ items, categories }）。読めなくてもページは出す（dishes.js の分だけ・価格なし） */
export async function loadPublicMenu() {
  try {
    const r = await fetch('/api/public/menu');
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** 名前：Squareの訳 → dishes.js の名前 */
export const dishName = (dish, item, lang) =>
  (dish.name && dish.name[lang]) || (item && item.names && item.names[lang]) || pickD(dish.name, lang) || dish.key;
