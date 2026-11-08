// 商品1品の紹介（写真スライド＋読み物）。注文画面のモーダルと、/menu/<slug> の単独ページで同じものを使う
import { DISH_CATS, ALLERGENS, pickD } from './dishes.js';

const L = {
  contents: { ja: '内容', en: "What's included", zht: '內容', zhs: '内容', ko: '구성' },
  serve: { ja: 'お届け', en: 'Served', zht: '供應時間', zhs: '供应时间', ko: '제공 시간' },
  portion: { ja: '量', en: 'Portion', zht: '份量', zhs: '份量', ko: '양' },
  allergens: { ja: 'アレルゲン', en: 'Allergens', zht: '過敏原', zhs: '过敏原', ko: '알레르기' },
  noAllergens: { ja: '特定原材料は使っていません', en: 'None of the major allergens', zht: '不含主要過敏原', zhs: '不含主要过敏原', ko: '주요 알레르기 성분 없음' },
  allergyNote: { ja: 'アレルギーのある方は、ご注文の前にお知らせください。', en: 'Please tell us about any allergies before ordering.', zht: '如有過敏，請於點餐前告知。', zhs: '如有过敏，请在点餐前告知。', ko: '알레르기가 있으시면 주문 전에 알려 주세요.' },
  prep: { ja: '事前予約制', en: 'Pre-order only', zht: '需事先預約', zhs: '需提前预订', ko: '사전 예약제' },
  shot: { ja: '撮影予定', en: 'Photo to come', zht: '照片準備中', zhs: '照片准备中', ko: '촬영 예정' },
  share: { ja: 'このページのリンクをコピー', en: 'Copy link to this page', zht: '複製此頁連結', zhs: '复制此页链接', ko: '이 페이지 링크 복사' },
  prevPhoto: { ja: '前の写真', en: 'Previous photo', zht: '上一張', zhs: '上一张', ko: '이전 사진' },
  nextPhoto: { ja: '次の写真', en: 'Next photo', zht: '下一張', zhs: '下一张', ko: '다음 사진' }
};
export const dl = (k, lang) => pickD(L[k], lang);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');

const camera = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.4"/></svg>';
const prev = '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const next = '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** 写真の枠：Squareの写真 → dishes.js の photos → 撮る予定のカット の順で使う */
export function slidesOf(dish, item) {
  if (item && item.images && item.images.length) return item.images.map((src) => ({ src }));
  if (dish && dish.photos && dish.photos.length) return dish.photos.map((src) => ({ src }));
  if (dish && dish.shots && dish.shots.length) return dish.shots.map((shot) => ({ shot }));
  return [{ shot: null }];
}

export function galleryHtml(slides, idx, lang) {
  const n = slides.length;
  const s = slides
    .map((x, k) =>
      x.src
        ? `<div class="dv-slide"><img src="${esc(x.src)}" alt="" decoding="async" ${k ? 'loading="lazy"' : ''}></div>`
        : `<div class="dv-slide dv-ph" style="--hue:${(k * 23) % 60}">${camera}<span class="k">${esc(dl('shot', lang))}</span>${x.shot ? `<span class="c">${esc(pickD(x.shot, lang))}</span>` : ''}</div>`
    )
    .join('');
  const nav =
    n > 1
      ? `<button class="dv-nb l" data-act="dv-prev" aria-label="${esc(dl('prevPhoto', lang))}" ${idx === 0 ? 'disabled' : ''}>${prev}</button>
         <button class="dv-nb r" data-act="dv-next" aria-label="${esc(dl('nextPhoto', lang))}" ${idx === n - 1 ? 'disabled' : ''}>${next}</button>
         <div class="dv-dots">${slides.map((_, k) => `<span class="${k === idx ? 'on' : ''}"></span>`).join('')}</div>
         <span class="dv-count">${idx + 1} / ${n}</span>`
      : '';
  return `<div class="dv-gallery"><div class="dv-track" style="transform:translateX(${-idx * 100}%)">${s}</div>${nav}</div>`;
}

/**
 * 本文。dish が無い品（読み物を書いていない品）は名前・説明・価格だけ出す
 * opts: { name, desc, price, extra（本文の最後に足すHTML）, share（リンクをコピーするボタンを出す） }
 */
export function dishBodyHtml(dish, lang, opts = {}) {
  const name = opts.name || (dish ? pickD(dish.name, lang) : '');
  const cat = dish && DISH_CATS[dish.cat];
  const badges = [cat ? `<span class="dv-badge">${esc(pickD(cat, lang))}</span>` : '', dish && dish.prep ? `<span class="dv-badge prep">${esc(dl('prep', lang))}</span>` : ''].join('');
  const priceRow =
    opts.price != null || (dish && dish.portion)
      ? `<div class="dv-price">${opts.price != null ? `<span class="v">${yen(opts.price)}</span>` : ''}${dish && dish.portion ? `<span class="u">${esc(pickD(dish.portion, lang))}</span>` : ''}</div>`
      : '';
  if (!dish) {
    return `<div class="dv-body"><h2 class="dv-title">${esc(name)}</h2>${opts.desc ? `<p class="dv-story">${esc(opts.desc)}</p>` : ''}${priceRow}${opts.extra || ''}</div>`;
  }
  const al = dish.allergens.length ? dish.allergens.map((a) => pickD(ALLERGENS[a], lang)).join('・') : dl('noAllergens', lang);
  const facts = [
    dish.serve ? [dl('serve', lang), pickD(dish.serve, lang)] : null,
    [dl('allergens', lang), al]
  ]
    .filter(Boolean)
    .map(([k, v]) => `<div class="dv-fact"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`)
    .join('');
  return `<div class="dv-body">
    <div class="dv-badges">${badges}</div>
    <h2 class="dv-title">${esc(name)}</h2>
    <p class="dv-kicker">${esc(pickD(dish.kicker, lang))}</p>
    ${priceRow}
    <p class="dv-story">${esc(pickD(dish.story, lang))}</p>
    <h3 class="dv-h">${esc(dl('contents', lang))}</h3>
    <ul class="dv-list">${dish.contents.map((c) => `<li>${esc(pickD(c, lang))}</li>`).join('')}</ul>
    <div class="dv-facts">${facts}</div>
    ${dish.note ? `<p class="dv-note">${esc(pickD(dish.note, lang))}</p>` : ''}
    <p class="dv-note muted">${esc(dl('allergyNote', lang))}</p>
    ${opts.share ? `<button class="dv-share" data-act="dv-share" data-slug="${esc(dish.slug)}">${esc(dl('share', lang))}</button>` : ''}
    ${opts.extra || ''}
  </div>`;
}

/** 写真のスワイプ。指に追従させて、離した位置で前後に送る。onChange(新しい番号) */
export function bindGallery(root, getIdx, onChange) {
  const g = root.querySelector('.dv-gallery');
  const track = g && g.querySelector('.dv-track');
  if (!g || !track) return;
  const n = track.children.length;
  if (n < 2) return;
  let x0 = null;
  let y0 = 0;
  let w = 1;
  let horiz = null;
  g.onpointerdown = (e) => {
    if (e.target.closest('button')) return;
    x0 = e.clientX;
    y0 = e.clientY;
    horiz = null;
    w = g.clientWidth || 1;
  };
  g.onpointermove = (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    if (horiz === null && (Math.abs(dx) > 6 || Math.abs(e.clientY - y0) > 6)) {
      horiz = Math.abs(dx) > Math.abs(e.clientY - y0);
      if (horiz) { track.classList.add('dragging'); g.setPointerCapture(e.pointerId); }
    }
    if (horiz) track.style.transform = `translateX(calc(${-getIdx() * 100}% + ${dx}px))`;
  };
  const end = (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    track.classList.remove('dragging');
    if (!horiz) return;
    let idx = getIdx();
    if (dx < -Math.min(60, w * 0.18) && idx < n - 1) idx++;
    else if (dx > Math.min(60, w * 0.18) && idx > 0) idx--;
    track.style.transform = `translateX(${-idx * 100}%)`;
    onChange(idx);
  };
  g.onpointerup = end;
  g.onpointercancel = end;
}
