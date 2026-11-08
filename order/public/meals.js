// /meals … Airbnb など、予約サイトに食事の申込欄がない予約向けの「夕食・朝食の事前申込」（モック）
//   ゲスト用：/meals?in=2026-11-20&n=2&g=2&name=Alex&code=HMABC123&lang=en
//   宿側（リンクとメッセージの文面を作る）：/meals?host=1
// モックなので申込はどこにも送らない。完了画面で申込内容の文面を出し、Airbnb のメッセージに貼ってもらう
import { DISHES, dishBySlug, pickD } from './dishes.js';
import { slidesOf, galleryHtml, dishBodyHtml, bindGallery } from './dish-view.js';
import { LANGS } from './i18n.js';
import { esc, yen, initialLang, setLang, pageHeader, loadPublicMenu, dishName } from './page-common.js';

/** チェックインの何日前までに受けるか（仮。仕入れと仕込みの都合で決める） */
const DEADLINE_DAYS = 3;
const DINNER_TIMES = ['18:00', '18:30', '19:00', '19:30'];
const BREAKFAST_TIMES = ['7:30', '7:45', '8:00', '8:15', '8:30', '8:45', '9:00'];

const L = {
  en: { ja: 'BEFORE YOU ARRIVE', en: 'BEFORE YOU ARRIVE' },
  title: { ja: 'お部屋での夕食・朝食を\nご用意しましょうか', en: 'Shall we prepare dinner\nand breakfast in your room?' },
  lead: {
    ja: '小夜月の夕食と朝食は、その日の仕入れに合わせて仕込むため事前のご予約制です。いる・いらないと、何人分かをお知らせください。料理をタップすると写真と内容が見られます。',
    en: 'Our dinners and breakfasts are prepared from that day’s market, so we need to know in advance. Let us know whether you’d like them and for how many. Tap a dish to see photos and details.'
  },
  deadline: { ja: 'お申し込みの締め切り', en: 'Please reply by' },
  over: { ja: '締め切りを過ぎています。ご用意できるか、メッセージでご相談ください。', en: 'The deadline has passed. Message us and we’ll see what we can do.' },
  stay: { ja: 'ご宿泊', en: 'Your stay' },
  checkin: { ja: 'チェックイン日', en: 'Check-in' },
  nights: { ja: '泊数', en: 'Nights' },
  guests: { ja: '人数', en: 'Guests' },
  nightN: { ja: '{n}泊目', en: 'Night {n}' },
  dinnerOf: { ja: '{d} の夕食', en: 'Dinner · {d}' },
  breakfastOf: { ja: '{d} の朝食', en: 'Breakfast · {d}' },
  time: { ja: 'ご希望の時間', en: 'Preferred time' },
  details: { ja: '写真と内容', en: 'Photos & details' },
  none: { ja: 'いりません', en: 'No thanks' },
  allergy: { ja: 'アレルギー・苦手な食材', en: 'Allergies or foods you avoid' },
  allergyPh: { ja: '例：1名がえびアレルギー', en: 'e.g. one guest is allergic to shrimp' },
  name: { ja: 'ご予約のお名前', en: 'Name on the booking' },
  code: { ja: 'Airbnb の予約コード（任意）', en: 'Airbnb confirmation code (optional)' },
  total: { ja: '合計（現地でお支払い）', en: 'Total (paid at the ryokan)' },
  submit: { ja: 'この内容で申し込む', en: 'Send my request' },
  noMeals: { ja: '夕食・朝食はいりません', en: "We don't need meals" },
  needName: { ja: 'ご予約のお名前を入れてください', en: 'Please enter the name on the booking' },
  needAny: { ja: '料理を選ぶか「夕食・朝食はいりません」を押してください', en: 'Choose a dish, or tap "We don\'t need meals"' },
  doneTitle: { ja: 'お申し込みを受け付けました', en: 'Request received' },
  doneNoMeals: { ja: 'お知らせありがとうございます', en: 'Thanks for letting us know' },
  doneLead: { ja: '仕込みの準備に入ります。ご到着を心よりお待ちしております。', en: 'We’ll start preparing. We look forward to welcoming you.' },
  copyLead: { ja: '念のため、下の内容を Airbnb のメッセージにも貼り付けてお送りください。', en: 'To be safe, please also paste the text below into your Airbnb message thread.' },
  copy: { ja: '内容をコピー', en: 'Copy text' },
  copied: { ja: 'コピーしました', en: 'Copied' },
  edit: { ja: '内容を直す', en: 'Edit my request' },
  mock: { ja: 'モック：申込はまだどこにも送られません（画面と流れの確認用）', en: 'Mock: nothing is sent yet (for reviewing the flow)' },
  close: { ja: '閉じる', en: 'Close' },
  perPerson: { ja: '人分', en: '' },
  // 宿側
  hostTitle: { ja: 'Airbnb のゲストに送る', en: 'Send to an Airbnb guest' },
  hostLead: { ja: '予約の内容を入れると、ゲスト用のリンクと、Airbnb のメッセージに貼る文面ができます。', en: 'Fill in the booking to get a guest link and a message to paste into Airbnb.' },
  guestName: { ja: 'ゲストのお名前', en: 'Guest name' },
  guestLang: { ja: 'ゲストの言語', en: "Guest's language" },
  link: { ja: 'ゲスト用リンク', en: 'Guest link' },
  message: { ja: 'メッセージの文面', en: 'Message' },
  preview: { ja: 'ゲストの画面を開く', en: 'Open guest view' }
};
const l = (k, vars = {}) => {
  let s = pickD(L[k], S.lang);
  for (const v in vars) s = s.split('{' + v + '}').join(vars[v]);
  return s;
};

// ---------- 状態 ----------
const qs = new URLSearchParams(location.search);
const todayJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

const S = {
  lang: initialLang(),
  host: qs.get('host') === '1',
  menu: null,
  checkin: /^\d{4}-\d{2}-\d{2}$/.test(qs.get('in') || '') ? qs.get('in') : addDays(todayJst(), 7),
  nights: clampInt(qs.get('n'), 1, 7, 1),
  guests: clampInt(qs.get('g'), 1, 8, 2),
  name: qs.get('name') || '',
  code: qs.get('code') || '',
  night: 0, // 表示中の泊（0始まり）
  sel: {}, // `${night}:${slug}` → 数
  time: {}, // `${night}:dinner` / `${night}:breakfast` → 時刻
  allergy: '',
  done: null, // 'meals' | 'none'
  modal: null, // { slug, idx, pushed, fresh }
  hostLang: 'en',
  error: ''
};

const dinners = DISHES.filter((d) => d.prep && d.cat === 'dinner');
const breakfasts = DISHES.filter((d) => d.prep && d.cat === 'breakfast');
const itemOf = (d) => S.menu && S.menu.find((i) => i.name === d.key);
const priceOf = (d) => itemOf(d)?.price ?? null;
const curLangCode = () => (LANGS.find((x) => x.id === S.lang) || LANGS[0]).code;
const fmtDate = (iso, lang = curLangCode()) =>
  new Date(iso + 'T00:00:00+09:00').toLocaleDateString(lang, { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' });
const deadline = () => addDays(S.checkin, -DEADLINE_DAYS);
const pastDeadline = () => todayJst() > deadline();
const qty = (n, slug) => S.sel[`${n}:${slug}`] || 0;
const nightHas = (n, list) => list.some((d) => qty(n, d.slug) > 0);
const anySelected = () => Object.values(S.sel).some((q) => q > 0);
const total = () =>
  Object.entries(S.sel).reduce((a, [k, q]) => a + (priceOf(dishBySlug(k.split(':')[1])) || 0) * q, 0);

// ---------- 描画 ----------
const root = document.getElementById('pg');
const I = {
  minus: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  moon: '<svg width="64" height="64" viewBox="0 0 72 72" aria-hidden="true"><path d="M47 10a28 28 0 1 0 16 46A30 30 0 0 1 47 10z" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
};

function stepper(key, q, max) {
  if (!q) return `<button class="add" data-act="q" data-k="${key}" data-d="1" aria-label="+">${I.plus}</button>`;
  return `<div class="stepper"><button data-act="q" data-k="${key}" data-d="-1" aria-label="-">${I.minus}</button><span class="q">${q}</span><button class="plus" data-act="q" data-k="${key}" data-d="1" aria-label="+" ${q >= max ? 'disabled' : ''}>${I.plus}</button></div>`;
}

function dishRow(n, d) {
  const item = itemOf(d);
  const q = qty(n, d.slug);
  const first = slidesOf(d, item)[0];
  const ph = first.src ? `<img src="${esc(first.src)}" alt="" loading="lazy">` : galleryHtml([first], 0, S.lang);
  const p = priceOf(d);
  return `<div class="mrow${q ? ' on' : ''}">
    <button class="ph" data-act="open" data-slug="${d.slug}" aria-label="${esc(l('details'))}">${ph}</button>
    <div class="tx"><span class="t">${esc(dishName(d, item, S.lang))}</span><span class="s">${esc(pickD(d.kicker, S.lang))}</span>
      <button class="lnk" data-act="open" data-slug="${d.slug}">${esc(l('details'))} ›</button>
      <div class="ft"><span class="p">${p != null ? yen(p) : ''} <span class="s">${esc(pickD(d.portion, S.lang))}</span></span>${stepper(`${n}:${d.slug}`, q, S.guests)}</div></div>
  </div>`;
}

function timeSelect(key, list) {
  const v = S.time[key] || list[0];
  return `<label class="fld"><span>${esc(l('time'))}</span><select data-in="time" data-k="${key}">${list.map((x) => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`;
}

function viewForm() {
  const over = pastDeadline();
  const n = Math.min(S.night, S.nights - 1);
  const nightTabs =
    S.nights > 1
      ? `<div class="nights" role="tablist">${Array.from({ length: S.nights }, (_, k) => {
          const has = nightHas(k, dinners) || nightHas(k, breakfasts);
          return `<button role="tab" data-act="night" data-n="${k}" aria-pressed="${k === n}"><b>${esc(l('nightN', { n: k + 1 }))}${has ? ' ●' : ''}</b>${esc(fmtDate(addDays(S.checkin, k)))}</button>`;
        }).join('')}</div>`
      : '';
  const dinnerDay = fmtDate(addDays(S.checkin, n));
  const bfDay = fmtDate(addDays(S.checkin, n + 1));
  const t = total();
  return `<main class="pg-main">
    <div class="mock-flag">${esc(l('mock'))}</div>
    <section class="mh"><p class="en">${esc(l('en'))}</p><h1>${esc(l('title')).replace('\n', '<br>')}</h1><p>${esc(l('lead'))}</p></section>
    <div class="deadline${over ? ' over' : ''}">${over ? `<span>${esc(l('over'))}</span>` : `<span>${esc(l('deadline'))}</span><b>${esc(fmtDate(deadline()))}</b>`}</div>

    <div class="pg-sec" style="margin-top:18px">
      <h2 class="cat-title">${esc(l('stay'))}</h2>
      <label class="fld"><span>${esc(l('checkin'))}</span><input type="date" data-in="checkin" value="${S.checkin}" min="${todayJst()}"></label>
      <div class="row2">
        <label class="fld"><span>${esc(l('nights'))}</span><select data-in="nights">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<option value="${k}" ${k === S.nights ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="fld"><span>${esc(l('guests'))}</span><select data-in="guests">${[1, 2, 3, 4, 5, 6, 7, 8].map((k) => `<option value="${k}" ${k === S.guests ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      </div>
      ${nightTabs}

      <h2 class="cat-title" style="margin-top:14px">${esc(l('dinnerOf', { d: dinnerDay }))}</h2>
      ${dinners.map((d) => dishRow(n, d)).join('')}
      ${nightHas(n, dinners) ? timeSelect(`${n}:dinner`, DINNER_TIMES) : ''}

      <h2 class="cat-title" style="margin-top:14px">${esc(l('breakfastOf', { d: bfDay }))}</h2>
      ${breakfasts.map((d) => dishRow(n, d)).join('')}
      ${nightHas(n, breakfasts) ? timeSelect(`${n}:breakfast`, BREAKFAST_TIMES) : ''}

      <h2 class="cat-title" style="margin-top:14px">${esc(l('name'))}</h2>
      <label class="fld"><span>${esc(l('name'))}</span><input data-in="name" value="${esc(S.name)}" autocomplete="name"></label>
      <label class="fld"><span>${esc(l('code'))}</span><input data-in="code" value="${esc(S.code)}" autocapitalize="characters"></label>
      <label class="fld"><span>${esc(l('allergy'))}</span><textarea data-in="allergy" placeholder="${esc(l('allergyPh'))}">${esc(S.allergy)}</textarea></label>
      ${S.error ? `<div class="notice" role="alert">${esc(S.error)}</div>` : ''}
      <button class="btn-ghost" data-act="none">${esc(l('noMeals'))}</button>
    </div>
    <div class="stickybar"><button class="btn-primary" data-act="submit">${esc(l('submit'))}${t ? `・${yen(t)}` : ''}</button></div>
  </main>`;
}

/** 申込内容の文面（Airbnb のメッセージに貼る・宿の控え） */
function summaryText(lang) {
  const tl = (k, v) => { let s = pickD(L[k], lang); for (const x in v || {}) s = s.split('{' + x + '}').join(v[x]); return s; };
  const code = (LANGS.find((x) => x.id === lang) || LANGS[0]).code;
  const head = [
    lang === 'ja' ? '【小夜月 夕食・朝食の申込】' : '[Sayozuki meal request]',
    `${tl('name')}: ${S.name}${S.code ? ` (${S.code})` : ''}`,
    `${tl('checkin')}: ${fmtDate(S.checkin, code)} / ${tl('nights')}: ${S.nights} / ${tl('guests')}: ${S.guests}`
  ];
  if (S.done === 'none') return [...head, lang === 'ja' ? '夕食・朝食：いりません' : "Dinner & breakfast: not needed"].join('\n');
  const lines = [];
  for (let n = 0; n < S.nights; n++) {
    for (const [list, key, off, label] of [[dinners, 'dinner', 0, 'dinnerOf'], [breakfasts, 'breakfast', 1, 'breakfastOf']]) {
      const picked = list.filter((d) => qty(n, d.slug) > 0);
      const day = fmtDate(addDays(S.checkin, n + off), code);
      if (!picked.length) { lines.push(`${tl(label, { d: day })}: ${tl('none')}`); continue; }
      const times = key === 'dinner' ? DINNER_TIMES : BREAKFAST_TIMES;
      lines.push(`${tl(label, { d: day })} ${S.time[`${n}:${key}`] || times[0]}`);
      for (const d of picked) lines.push(`  ・${dishName(d, itemOf(d), lang)} × ${qty(n, d.slug)}`);
    }
  }
  if (S.allergy.trim()) lines.push(`${tl('allergy')}: ${S.allergy.trim()}`);
  const t = total();
  if (t) lines.push(`${tl('total')}: ${yen(t)}`);
  return [...head, '', ...lines].join('\n');
}

function viewDone() {
  const text = summaryText(S.lang);
  return `<main class="pg-main">
    <div class="mock-flag">${esc(l('mock'))}</div>
    <section class="done-hero"><span style="color:var(--accent)">${I.moon}</span><div class="t">${esc(l(S.done === 'none' ? 'doneNoMeals' : 'doneTitle'))}</div><p>${esc(l('doneLead'))}</p></section>
    <div class="pg-sec">
      <p class="lead">${esc(l('copyLead'))}</p>
      <div class="copybox">${esc(text)}</div>
      <button class="btn-primary" data-act="copy" data-text="${esc(text)}">${esc(l('copy'))}</button>
      <button class="btn-ghost" data-act="edit">${esc(l('edit'))}</button>
    </div>
  </main>`;
}

// 宿側：ゲストに送るリンクと文面を作る
function guestUrl() {
  const u = new URL('/meals', location.origin);
  u.searchParams.set('in', S.checkin);
  u.searchParams.set('n', S.nights);
  u.searchParams.set('g', S.guests);
  if (S.name) u.searchParams.set('name', S.name);
  if (S.code) u.searchParams.set('code', S.code);
  u.searchParams.set('lang', S.hostLang);
  return u.toString();
}
function hostMessage() {
  const url = guestUrl();
  const menu = `${location.origin}/menu?lang=${S.hostLang}`;
  const dl = fmtDate(deadline(), S.hostLang === 'ja' ? 'ja' : 'en');
  if (S.hostLang === 'ja')
    return `${S.name || '〇〇'}様\n\nご予約ありがとうございます。小夜月です。\n当館の夕食・朝食はお部屋でお召し上がりいただけます。仕込みの都合で事前のご予約制のため、${dl}までに、ご希望かどうかと何人分かを下のページからお知らせください。\n\n▼夕食・朝食のお申し込み\n${url}\n\n▼料理の写真と内容\n${menu}\n\nお食事が不要な場合も、ページの「夕食・朝食はいりません」を押していただけると助かります。`;
  return `Hi ${S.name || 'there'},\n\nThank you for booking Sayozuki. Dinner and breakfast can be served in your room. Because we prepare them to order, please let us know by ${dl} whether you'd like them and for how many guests:\n\nBook dinner & breakfast:\n${url}\n\nPhotos and details of each dish:\n${menu}\n\nIf you don't need meals, just tap "We don't need meals" on the page. Thank you!`;
}
function viewHost() {
  const msg = hostMessage();
  return `<main class="pg-main">
    <div class="mock-flag">${esc(l('mock'))}</div>
    <section class="mh"><p class="en">FOR STAFF</p><h1>${esc(l('hostTitle'))}</h1><p>${esc(l('hostLead'))}</p></section>
    <div class="pg-sec">
      <label class="fld"><span>${esc(l('guestName'))}</span><input data-in="name" value="${esc(S.name)}"></label>
      <label class="fld"><span>${esc(l('code'))}</span><input data-in="code" value="${esc(S.code)}" autocapitalize="characters"></label>
      <label class="fld"><span>${esc(l('checkin'))}</span><input type="date" data-in="checkin" value="${S.checkin}"></label>
      <div class="row2">
        <label class="fld"><span>${esc(l('nights'))}</span><select data-in="nights">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<option value="${k}" ${k === S.nights ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="fld"><span>${esc(l('guests'))}</span><select data-in="guests">${[1, 2, 3, 4, 5, 6, 7, 8].map((k) => `<option value="${k}" ${k === S.guests ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      </div>
      <span class="lead" style="margin:0">${esc(l('guestLang'))}</span>
      <div class="seg3">${LANGS.slice(0, 3).map((x) => `<button data-act="hlang" data-id="${x.id}" aria-pressed="${S.hostLang === x.id}">${x.label}</button>`).join('')}</div>
      <h2 class="cat-title">${esc(l('link'))}</h2>
      <div class="copybox">${esc(guestUrl())}</div>
      <div class="row2"><button class="btn-ghost" data-act="copy" data-text="${esc(guestUrl())}">${esc(l('copy'))}</button><a class="btn-ghost" href="${esc(guestUrl())}" target="_blank" rel="noopener">${esc(l('preview'))}</a></div>
      <h2 class="cat-title">${esc(l('message'))}</h2>
      <div class="copybox">${esc(msg)}</div>
      <button class="btn-primary" data-act="copy" data-text="${esc(msg)}">${esc(l('copy'))}</button>
    </div>
  </main>`;
}

function modalHtml() {
  const d = dishBySlug(S.modal.slug);
  if (!d) return '';
  const item = itemOf(d);
  const slides = slidesOf(d, item);
  return `<div class="dmodal" role="dialog" aria-modal="true" aria-label="${esc(dishName(d, item, S.lang))}">
    <button class="backdrop" data-act="close" aria-label="${esc(l('close'))}"></button>
    <div class="dm-card"${S.modal.fresh ? '' : ' style="animation:none"'}>
      <button class="dm-close" data-act="close" aria-label="${esc(l('close'))}">${I.close}</button>
      <div class="dm-scroll">${galleryHtml(slides, Math.min(S.modal.idx, slides.length - 1), S.lang)}${dishBodyHtml(d, S.lang, { name: dishName(d, item, S.lang), price: priceOf(d) })}</div>
      <div class="dm-bar"><button class="btn-ghost" style="flex:1" data-act="close">${esc(l('close'))}</button></div>
    </div></div>`;
}

function render() {
  setLang(S.lang);
  const sc = root.querySelector('.dm-scroll')?.scrollTop || 0;
  const body = S.host ? viewHost() : S.done ? viewDone() : viewForm();
  root.innerHTML = pageHeader(S.lang) + body + (S.modal ? modalHtml() : '');
  document.body.style.overflow = S.modal ? 'hidden' : '';
  if (S.modal) {
    const el = root.querySelector('.dm-scroll');
    if (el && !S.modal.fresh) el.scrollTop = sc;
    S.modal.fresh = false;
    bindGallery(root.querySelector('.dmodal'), () => S.modal.idx, (i) => { S.modal.idx = i; render(); });
  }
}

// ---------- 操作 ----------
function openModal(slug, push = true) {
  S.modal = { slug, idx: 0, pushed: push, fresh: true };
  if (push) history.pushState({ dish: slug }, '', location.pathname + location.search + '#' + slug);
  render();
}
function closeModal() {
  if (!S.modal) return;
  if (S.modal.pushed) return history.back();
  S.modal = null;
  history.replaceState(null, '', location.pathname + location.search);
  render();
}
window.addEventListener('popstate', () => {
  const slug = decodeURIComponent(location.hash.slice(1));
  if (S.modal && !slug) { S.modal = null; return render(); }
  if (slug && dishBySlug(slug)) openModal(slug, false);
});

root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act } = el.dataset;
  switch (act) {
    case 'lang': S.lang = el.dataset.id; return render();
    case 'hlang': S.hostLang = el.dataset.id; return render();
    case 'night': S.night = Number(el.dataset.n); return render();
    case 'q': {
      const k = el.dataset.k;
      S.sel[k] = Math.max(0, Math.min(S.guests, (S.sel[k] || 0) + Number(el.dataset.d)));
      if (!S.sel[k]) delete S.sel[k];
      S.error = '';
      return render();
    }
    case 'open': return openModal(el.dataset.slug);
    case 'close': return closeModal();
    case 'dv-prev': S.modal.idx = Math.max(0, S.modal.idx - 1); return render();
    case 'dv-next': S.modal.idx += 1; return render();
    case 'submit':
    case 'none': {
      if (!S.name.trim()) { S.error = l('needName'); render(); return root.querySelector('[data-in="name"]')?.focus(); }
      if (act === 'submit' && !anySelected()) { S.error = l('needAny'); return render(); }
      S.error = '';
      S.done = act === 'none' ? 'none' : 'meals';
      window.scrollTo({ top: 0 });
      return render();
    }
    case 'edit': S.done = null; return render();
    case 'copy': {
      try { await navigator.clipboard.writeText(el.dataset.text || ''); } catch {}
      const before = el.textContent;
      el.textContent = l('copied');
      setTimeout(() => { el.textContent = before; }, 1600);
      return;
    }
  }
});

// 入力は描き直さずに持っておく（泊数・人数・日付のように画面が変わるものだけ描き直す）
root.addEventListener('input', (e) => {
  const k = e.target.dataset.in;
  if (!k) return;
  const v = e.target.value;
  if (k === 'name') S.name = v;
  if (k === 'code') S.code = v.toUpperCase();
  if (k === 'allergy') S.allergy = v;
  if (S.host && (k === 'name' || k === 'code')) refreshHostOutputs();
});
root.addEventListener('change', (e) => {
  const k = e.target.dataset.in;
  if (!k) return;
  const v = e.target.value;
  if (k === 'checkin' && /^\d{4}-\d{2}-\d{2}$/.test(v)) S.checkin = v;
  if (k === 'nights') { S.nights = clampInt(v, 1, 7, 1); S.night = Math.min(S.night, S.nights - 1); }
  if (k === 'guests') {
    S.guests = clampInt(v, 1, 8, 2);
    for (const key in S.sel) S.sel[key] = Math.min(S.sel[key], S.guests);
  }
  if (k === 'time') S.time[e.target.dataset.k] = v;
  if (['checkin', 'nights', 'guests'].includes(k)) render();
  if (S.host && (k === 'name' || k === 'code')) render();
});
function refreshHostOutputs() {
  const boxes = root.querySelectorAll('.copybox');
  const btns = root.querySelectorAll('[data-act="copy"]');
  if (boxes[0]) boxes[0].textContent = guestUrl();
  if (boxes[1]) boxes[1].textContent = hostMessage();
  if (btns[0]) btns[0].dataset.text = guestUrl();
  if (btns[1]) btns[1].dataset.text = hostMessage();
  const a = root.querySelector('a[target="_blank"]');
  if (a) a.href = guestUrl();
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.modal) closeModal(); });

render();
if (location.hash && dishBySlug(decodeURIComponent(location.hash.slice(1)))) openModal(decodeURIComponent(location.hash.slice(1)), false);
loadPublicMenu().then((m) => { S.menu = m; render(); });
