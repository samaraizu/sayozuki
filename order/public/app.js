import { LANGS, ABOUT, REQUESTS, STAY_INFO, makeT, pick } from './i18n.js';

// ---------- 状態 ----------
const qs = new URLSearchParams(location.search);
const ROOM_KEY = 'syz_r';
const urlRoom = qs.get('r');
if (urlRoom) localStorage.setItem(ROOM_KEY, urlRoom);
const justPaid = qs.get('paid') === '1';
if (justPaid) history.replaceState(null, '', location.pathname + (urlRoom ? '?r=' + encodeURIComponent(urlRoom) : ''));

const S = {
  room: urlRoom || localStorage.getItem(ROOM_KEY),
  paidRecently: justPaid,
  lang: localStorage.getItem('syz_lang') || detectLang(),
  tab: 'menu',
  cat: 'all',
  cart: {},
  delivery: 'door',
  sheet: false,
  langOpen: false,
  viewer: null, // { id, idx }
  done: false,
  sending: false,
  session: null,
  menu: null,
  bill: null,
  requested: new Set(),
  fatal: null
};
let t = makeT(S.lang);

function detectLang() {
  const n = (navigator.language || 'ja').toLowerCase();
  if (n.startsWith('ja')) return 'ja';
  if (n.startsWith('ko')) return 'ko';
  if (n.startsWith('zh')) return /tw|hk|hant/.test(n) ? 'zht' : 'zhs';
  return 'en';
}

// ---------- 通信 ----------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'x-room': S.room || '', ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'http'), { status: res.status, code: data.error, detail: data.detail });
  return data;
}

async function loadAll() {
  try {
    const [session, menu, bill] = await Promise.all([api('/api/session'), api('/api/menu'), api('/api/orders')]);
    S.session = session;
    S.menu = menu;
    S.bill = bill;
    S.requested = new Set(session.requested || []);
    markSeenDelivered(true);
  } catch (e) {
    S.fatal = e.status === 401 ? 'noToken' : 'errNetwork';
  }
  render();
}

async function refresh() {
  if (!S.room || S.fatal) return;
  try {
    const [session, bill] = await Promise.all([api('/api/session'), api('/api/orders')]);
    const hadPay = Boolean(S.bill && S.bill.payUrl);
    S.session = session;
    S.bill = bill;
    if (markSeenDelivered(false)) toast(t('arrived'));
    if (hadPay && !bill.payUrl) { S.paidRecently = true; toast(t('thanksPaid')); }
    render();
  } catch {}
}

async function refreshMenu() {
  try {
    S.menu = await api('/api/menu');
    pruneCart();
    render();
  } catch {}
}

// お届け済みになった注文を検知して通知（同じ注文は一度だけ）
function markSeenDelivered(silent) {
  const key = 'syz_seen';
  const seen = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  let fresh = false;
  for (const o of (S.bill && S.bill.orders) || []) {
    if (o.status === 'delivered' && !seen.has(o.id)) {
      seen.add(o.id);
      fresh = true;
    }
  }
  localStorage.setItem(key, JSON.stringify([...seen].slice(-200)));
  return fresh && !silent;
}

// ---------- ヘルパー ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');
const curLang = () => LANGS.find((l) => l.id === S.lang) || LANGS[0];
const itemName = (i) => pick(i.names, S.lang, i.name);
const itemDesc = (i) => pick(i.descs, S.lang, i.desc);
const catName = (c) => pick(c.names, S.lang, c.name);
const byId = (id) => S.menu && S.menu.items.find((i) => i.id === id);
const catOf = (i) => S.menu && S.menu.categories.find((c) => c.name === i.category);
const orderable = (i) => S.menu && S.menu.open && !i.soldOut && !(catOf(i) || {}).closed;
const maxQty = (i) => (i.left == null ? 20 : i.left);
const cartCount = () => Object.values(S.cart).reduce((a, b) => a + b, 0);
const cartTotal = () => Object.entries(S.cart).reduce((a, [id, q]) => a + (byId(id)?.price || 0) * q, 0);

function setQty(id, q) {
  const item = byId(id);
  if (!item) return;
  q = Math.max(0, Math.min(maxQty(item), q));
  if (q === 0) delete S.cart[id];
  else S.cart[id] = q;
  if (!cartCount()) S.sheet = false;
  render();
}

function pruneCart() {
  for (const id of Object.keys(S.cart)) {
    const i = byId(id);
    if (!i || !orderable(i)) delete S.cart[id];
    else if (S.cart[id] > maxQty(i)) S.cart[id] = maxQty(i);
  }
}

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

function loadLangFont() {
  const f = curLang().font;
  document.documentElement.lang = curLang().code;
  if (!f || document.getElementById('font-' + f)) return;
  const l = document.createElement('link');
  l.id = 'font-' + f;
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${f}:wght@400;500;700&display=swap`;
  document.head.appendChild(l);
}

// ---------- アイコン ----------
const I = {
  moon: '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M17 3a10 10 0 1 0 6 17A11 11 0 0 1 17 3z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/><path d="M2 9h14M9 2c2 2 3 4.3 3 7s-1 5-3 7c-2-2-3-4.3-3-7s1-5 3-7z" stroke="currentColor" stroke-width="1.4"/></svg>',
  plus: (c = '#fff') => `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`,
  minus: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  photo: (c = 'currentColor', s = 26) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="${c}" stroke-width="1.5"/><circle cx="9" cy="10" r="1.6" stroke="${c}" stroke-width="1.5"/><path d="M4 17l5-4 4 3 3-2 4 3" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  stack: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="2" width="6" height="6" rx="1" fill="none" stroke="#fff" stroke-width="1"/><path d="M3 1h6v6" fill="none" stroke="#fff" stroke-width="1"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="#F3EEE4" stroke-width="1.8" stroke-linecap="round"/></svg>',
  prev: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="#F3EEE4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5" fill="none" stroke="#F3EEE4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9.5l3.2 3L14 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ext: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M7 4h7v7M14 4l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  navMenu: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M4 6h14M4 11h14M4 16h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  navReq: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M6 9a5 5 0 0 1 10 0v4l2 3H4l2-3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 19h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  navBill: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M5 3h12v16l-3-2-3 2-3-2-3 2z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 8h6M8 12h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  navAbout: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M11 10v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="11" cy="7" r="1" fill="currentColor"/></svg>'
};

// ---------- 描画 ----------
const app = document.getElementById('app');

function render() {
  t = makeT(S.lang);
  loadLangFont();
  const chipsScroll = app.querySelector('.chips')?.scrollLeft || 0;

  if (!S.room || S.fatal) {
    app.innerHTML = header(false) + `<div class="center-msg">${esc(t(S.fatal || 'noToken'))}</div>` + overlays();
    return;
  }
  if (!S.session) {
    app.innerHTML = header(false) + `<main>${'<div class="skeleton"></div>'.repeat(5)}</main>`;
    return;
  }

  const body = { menu: viewMenu, request: viewRequest, bill: viewBill, about: viewAbout }[S.tab]();
  app.innerHTML = header(true) + body + cartBar() + nav() + overlays();
  const chips = app.querySelector('.chips');
  if (chips) chips.scrollLeft = chipsScroll;
  const h = app.querySelector('.header');
  if (h) app.style.setProperty('--header-h', h.offsetHeight + 'px');
  if (S.viewer) bindViewerDrag();
}

function header(full) {
  const s = S.session;
  const banner = !full
    ? ''
    : S.menu && !S.menu.open
      ? `<div class="banner closed">${esc(t('orderingClosed'))}</div>`
      : `<div class="banner"><span class="muted">${esc(t('lastOrder', { t: s.lastOrder }))}</span><span>${esc(t('deliveryNote'))}</span></div>`;
  return `<header class="header">
    <div class="brand-row">
      <div class="brand"><span style="color:var(--accent)">${I.moon}</span>
        <div><div class="brand-name"><span class="brand-ja">小夜月</span><span class="brand-en" lang="en">Sayozuki</span></div>
        ${s ? `<div class="room">${esc(t('room', { r: s.room }))}</div>` : ''}</div>
      </div>
      <button class="lang-btn" data-act="lang-open" aria-label="${esc(t('langTitle'))}">${I.globe}${esc(curLang().short)}</button>
    </div>${banner}
  </header>`;
}

function itemCard(i) {
  const q = S.cart[i.id] || 0;
  const name = itemName(i);
  const cat = catOf(i) || {};
  const thumb = i.images.length
    ? `<img src="${esc(i.images[0])}" alt="" loading="lazy" decoding="async">${i.images.length > 1 ? `<span class="count">${I.stack}${i.images.length}</span>` : ''}`
    : `<span style="color:var(--dim)">${I.photo()}</span>`;
  let action;
  if (i.soldOut) action = `<span class="tag-sold">${esc(t('soldOut'))}</span>`;
  else if (cat.closed || !S.menu.open) action = `<span class="tag-sold">${esc(t('closedCat'))}</span>`;
  else if (!q) action = `<button class="add" data-act="inc" data-id="${esc(i.id)}" aria-label="${esc(t('add', { n: name }))}">${I.plus()}</button>`;
  else
    action = `<div class="stepper"><button data-act="dec" data-id="${esc(i.id)}" aria-label="${esc(t('dec'))}">${I.minus}</button><span class="q">${q}</span><button class="plus" data-act="inc" data-id="${esc(i.id)}" aria-label="${esc(t('inc'))}">${I.plus()}</button></div>`;
  const left = !i.soldOut && i.left != null ? `<span class="left">${esc(t('left', { n: Math.max(0, i.left - q) }))}</span>` : '';
  return `<div class="card${i.soldOut ? ' sold' : ''}">
    <button class="thumb" data-act="photos" data-id="${esc(i.id)}" aria-label="${esc(t('photos', { n: name }))}">${thumb}</button>
    <div class="info"><div class="name-row"><span class="name">${esc(name)}</span>${left}</div>
      ${itemDesc(i) ? `<span class="desc">${esc(itemDesc(i))}</span>` : ''}
      <span class="price">${yen(i.price)}</span></div>
    ${action}
  </div>`;
}

function viewMenu() {
  const cats = S.menu.categories;
  const chips = [{ name: 'all', label: t('all') }, ...cats.map((c) => ({ name: c.name, label: catName(c) }))]
    .map((c) => `<button class="chip" data-act="cat" data-id="${esc(c.name)}" aria-pressed="${S.cat === c.name}">${esc(c.label)}</button>`)
    .join('');
  const sections = cats
    .filter((c) => S.cat === 'all' || S.cat === c.name)
    .map((c) => {
      const items = S.menu.items.filter((i) => i.category === c.name);
      if (!items.length) return '';
      const title = S.cat === 'all' ? `<h3 class="cat-title">${esc(catName(c))}${c.cutoff && !c.closed ? `<small>〜${esc(c.cutoff)}</small>` : ''}</h3>` : '';
      return title + items.map(itemCard).join('');
    })
    .join('');
  return `<nav class="chips" aria-label="${esc(t('navMenu'))}">${chips}</nav><main>${sections}</main>`;
}

function viewRequest() {
  const dnd = S.session.dnd;
  const rows = REQUESTS.map((r) => {
    const sent = S.requested.has(r.kind);
    return `<div class="row-card"><span><span class="t">${esc(pick(r.name, S.lang))}</span><span class="s">${esc(pick(r.sub, S.lang))}</span></span>
      <button class="req-btn" data-act="req" data-id="${r.kind}" aria-pressed="${sent}" ${sent ? 'disabled' : ''}>${esc(t(sent ? 'reqDone' : 'reqDo'))}</button></div>`;
  }).join('');
  return `<main><h2 class="h2">${esc(t('reqTitle'))}</h2><p class="lead">${esc(t('reqLead'))}</p>
    <div class="row-card"><span><span class="t">${esc(t('dndTitle'))}</span><span class="s">${esc(t('dndSub'))}</span></span>
      <button class="switch" data-act="dnd" aria-pressed="${dnd}" aria-label="${esc(t('dndTitle'))}"><span></span></button></div>
    ${rows}</main>`;
}

function viewBill() {
  const b = S.bill;
  const s = S.session;
  const st = { new: 'preparing', delivered: 'delivered', canceled: 'canceled' };
  const lines = b.orders
    .flatMap((o) =>
      o.lines.map((l) => {
        const item = byId(l.variationId);
        const name = item ? itemName(item) : l.name;
        const time = new Date(o.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
        return `<div class="bill-line"${o.status === 'canceled' ? ' style="opacity:.5;text-decoration:line-through"' : ''}><span>${esc(name)} × ${l.qty}<span class="st">${time}・${esc(t(st[o.status]))}</span></span><span class="amt">${yen(l.price * l.qty)}</span></div>`;
      })
    )
    .join('');
  let action = '';
  if (b.payUrl)
    action = `<div class="notice">${esc(t('payLead'))}</div><a class="btn-primary" href="${esc(b.payUrl)}" rel="noopener">${esc(t('payNow'))}・${yen(b.pendingTotal)}</a>`;
  else if (S.paidRecently)
    action = `<div class="notice">${esc(t('paid'))}</div><a class="btn-ghost" href="/receipt">${esc(t('receipt'))}</a>`;
  return `<main><h2 class="h2">${esc(t('billTitle'))}</h2><p class="lead">${esc(t('billLead'))}</p>
    <div class="bill">
      ${lines || `<div class="lead" style="padding:8px 0">${esc(t('noOrders'))}</div>`}
      <div class="bill-total"><span style="font-weight:700">${esc(t('total'))}</span><span class="v">${yen(b.total)}</span></div>
    </div>${action}</main>`;
}

function viewAbout() {
  // HPのご案内は /guide（日本語）・/en/guide・/zh/guide（簡体字のみ）・/ko/guide
  const g = new URL(S.session.guideBase || 'https://sayozuki.com/guide');
  const prefix = { ja: '', en: '/en', zht: '/zh', zhs: '/zh', ko: '/ko' }[S.lang] ?? '/en';
  const base = `${g.origin}${prefix}${g.pathname.replace(/\/$/, '')}`;
  const links = ABOUT.map(
    (a) => `<a class="row-card" href="${esc(base)}/${a.slug}" target="_blank" rel="noopener">
      <span><span class="t">${esc(pick(a.name, S.lang))}</span><span class="s">${esc(pick(a.sub, S.lang))}</span></span><span style="color:var(--accent)">${I.ext}</span></a>`
  ).join('');
  return `<main><h2 class="h2">${esc(t('aboutTitle'))}</h2><p class="lead">${esc(t('aboutLead'))}</p>
    <div class="wifi"><div><span class="k">Wi-Fi</span><span class="v">${esc(STAY_INFO.wifiSsid)}</span></div><div><span class="k">${esc(t('wifiPass'))}</span><span class="v">${esc(STAY_INFO.wifiPass)}</span></div></div>
    ${links}<p class="foot">${esc(t('opensSite'))}</p></main>`;
}

function cartBar() {
  if (S.tab !== 'menu' || !cartCount() || S.sheet || S.viewer || S.done) return '';
  return `<div class="cartbar"><button data-act="sheet-open"><span><span class="n">${cartCount()}</span>${esc(t('checkCart'))}</span><span>${yen(cartTotal())}</span></button></div>`;
}

function nav() {
  const tabs = [
    ['menu', 'navMenu', I.navMenu],
    ['request', 'navRequest', I.navReq],
    ['bill', 'navBill', I.navBill],
    ['about', 'navAbout', I.navAbout]
  ];
  const payDot = Boolean(S.bill && S.bill.payUrl);
  return `<nav class="nav" aria-label="main">${tabs
    .map(([id, k, icon]) => `<button data-act="tab" data-id="${id}" ${S.tab === id ? 'aria-current="page"' : ''}>${icon}${esc(t(k))}${id === 'bill' && payDot ? '<span class="dot"></span>' : ''}</button>`)
    .join('')}</nav>`;
}

function overlays() {
  let h = '';
  if (S.sheet && cartCount()) {
    const lines = Object.entries(S.cart)
      .map(([id, q]) => {
        const i = byId(id);
        return `<div class="line"><div class="info"><span class="name">${esc(itemName(i))}</span><span class="desc">${yen(i.price * q)}</span></div>
          <div class="stepper"><button data-act="dec" data-id="${esc(id)}" aria-label="${esc(t('dec'))}">${I.minus}</button><span class="q">${q}</span><button class="plus" data-act="inc" data-id="${esc(id)}" aria-label="${esc(t('inc'))}">${I.plus()}</button></div></div>`;
      })
      .join('');
    h += `<div class="overlay"><button class="backdrop" data-act="sheet-close" aria-label="${esc(t('close'))}"></button>
      <div class="sheet" role="dialog" aria-label="${esc(t('sheetTitle'))}"><span class="grip"></span>
        <h2 class="h2" style="margin:0">${esc(t('sheetTitle'))}</h2>${lines}
        <div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line2);padding-top:12px">
          <span class="lead" style="margin:0">${esc(t('deliveryLabel'))}</span>
          <div class="seg"><button data-act="delivery" data-id="door" aria-pressed="${S.delivery === 'door'}">${esc(t('door'))}</button><button data-act="delivery" data-id="hand" aria-pressed="${S.delivery === 'hand'}">${esc(t('hand'))}</button></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="lead" style="margin:0">${esc(t('roomCharge'))}</span><span style="font-family:var(--mincho);font-size:24px;font-weight:700">${yen(cartTotal())}</span></div>
        <button class="btn-primary" data-act="order" ${S.sending ? 'disabled' : ''}>${esc(t(S.sending ? 'sending' : 'placeOrder'))}</button>
      </div></div>`;
  }
  if (S.langOpen) {
    h += `<div class="overlay"><button class="backdrop" data-act="lang-close" aria-label="${esc(t('close'))}"></button>
      <div class="sheet" role="dialog" aria-label="${esc(t('langTitle'))}"><span class="grip"></span>
        <span class="lead" style="margin:0">${esc(t('langTitle'))} / Language</span>
        ${LANGS.map((l) => `<button class="lang-opt" lang="${l.code}" data-act="lang" data-id="${l.id}" aria-pressed="${S.lang === l.id}"><span>${l.label}</span>${S.lang === l.id ? `<span style="color:var(--accent)">${I.check}</span>` : ''}</button>`).join('')}
      </div></div>`;
  }
  if (S.viewer) h += viewerHtml();
  if (S.done) {
    h += `<div class="done"><span style="color:var(--accent)"><svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true"><path d="M47 10a28 28 0 1 0 16 46A30 30 0 0 1 47 10z" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
      <div class="t">${esc(t('doneTitle'))}</div><p>${esc(t(S.delivery === 'door' ? 'doneDoor' : 'doneHand'))}<br>${esc(t('doneNotify'))}</p>
      <button class="btn-ghost" data-act="done-close">${esc(t('back'))}</button></div>`;
  }
  return h;
}

function viewerHtml() {
  const i = byId(S.viewer.id);
  if (!i) return '';
  const imgs = i.images.length ? i.images : [null];
  const n = imgs.length;
  const idx = Math.min(S.viewer.idx, n - 1);
  const q = S.cart[i.id] || 0;
  const slides = imgs
    .map((src) => `<div class="slide">${src ? `<img src="${esc(src)}" alt="" decoding="async">` : `<div class="ph">${I.photo('#8C8476', 44)}<span>${esc(t('photoSoon'))}</span></div>`}</div>`)
    .join('');
  let btn;
  if (i.soldOut) btn = `<span class="vsold">${esc(t('soldOut'))}</span>`;
  else if (!orderable(i)) btn = `<span class="vsold">${esc(t('closedCat'))}</span>`;
  else if (q >= maxQty(i)) btn = `<span class="vsold">${esc(t('added', { q }))}</span>`;
  else btn = `<button class="vbtn" data-act="inc" data-id="${esc(i.id)}">${esc(q ? t('addMore', { q }) : t('addToOrder', { p: yen(i.price) }))}</button>`;
  return `<div class="viewer" role="dialog" aria-label="${esc(itemName(i))}">
    <div class="top"><span>${n > 1 ? `${idx + 1} / ${n}` : ''}</span><button class="icon-btn" data-act="viewer-close" aria-label="${esc(t('close'))}">${I.close}</button></div>
    <div class="stage"><div class="track" style="transform:translateX(${-idx * 100}%)">${slides}</div></div>
    ${n > 1 ? `<div class="pager"><button class="nb" data-act="vprev" aria-label="${esc(t('prevPhoto'))}" ${idx === 0 ? 'disabled' : ''}>${I.prev}</button>
      <div class="dots">${imgs.map((_, k) => `<span class="${k === idx ? 'on' : ''}"></span>`).join('')}</div>
      <button class="nb" data-act="vnext" aria-label="${esc(t('nextPhoto'))}" ${idx === n - 1 ? 'disabled' : ''}>${I.next}</button></div>` : ''}
    <div class="detail"><div><div class="vname">${esc(itemName(i))}</div>${itemDesc(i) ? `<div class="vdesc">${esc(itemDesc(i))}</div>` : ''}<div style="margin-top:4px">${yen(i.price)}</div></div>${btn}</div>
  </div>`;
}

// スワイプ：指に追従させて、離した位置で前後に送る
function bindViewerDrag() {
  const stage = app.querySelector('.stage');
  const track = app.querySelector('.track');
  if (!stage || !track) return;
  const n = track.children.length;
  let x0 = null;
  let w = 1;
  stage.onpointerdown = (e) => {
    x0 = e.clientX;
    w = stage.clientWidth || 1;
    track.classList.add('dragging');
    stage.setPointerCapture(e.pointerId);
  };
  stage.onpointermove = (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    const base = -S.viewer.idx * 100;
    track.style.transform = `translateX(calc(${base}% + ${dx}px))`;
  };
  const end = (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    track.classList.remove('dragging');
    let idx = S.viewer.idx;
    if (dx < -Math.min(60, w * 0.18) && idx < n - 1) idx++;
    else if (dx > Math.min(60, w * 0.18) && idx > 0) idx--;
    S.viewer.idx = idx;
    render();
  };
  stage.onpointerup = end;
  stage.onpointercancel = end;
}

// ---------- 操作 ----------
const ERR = { sold_out: 'errSoldOut', category_closed: 'errCatClosed', ordering_closed: 'orderingClosed' };

async function placeOrder() {
  if (S.sending) return;
  S.sending = true;
  render();
  try {
    await api('/api/orders', { method: 'POST', body: { lines: Object.entries(S.cart).map(([id, qty]) => ({ id, qty })), delivery: S.delivery } });
    S.cart = {};
    S.sheet = false;
    S.done = true;
    navigator.vibrate?.(30);
    refresh();
    refreshMenu();
  } catch (e) {
    const key = ERR[e.code];
    toast(key ? t(key, { n: e.detail || '' }) : t('errNetwork'));
    if (e.code === 'sold_out' || e.code === 'category_closed') await refreshMenu();
  } finally {
    S.sending = false;
    render();
  }
}

app.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'tab': S.tab = id; S.sheet = false; window.scrollTo({ top: 0 }); return render();
    case 'cat': S.cat = id; window.scrollTo({ top: 0 }); return render();
    case 'inc': return setQty(id, (S.cart[id] || 0) + 1);
    case 'dec': return setQty(id, (S.cart[id] || 0) - 1);
    case 'photos': S.viewer = { id, idx: 0 }; return render();
    case 'viewer-close': S.viewer = null; return render();
    case 'vprev': S.viewer.idx = Math.max(0, S.viewer.idx - 1); return render();
    case 'vnext': S.viewer.idx += 1; return render();
    case 'sheet-open': S.sheet = true; return render();
    case 'sheet-close': S.sheet = false; return render();
    case 'delivery': S.delivery = id; return render();
    case 'order': return placeOrder();
    case 'done-close': S.done = false; S.tab = 'menu'; return render();
    case 'lang-open': S.langOpen = true; return render();
    case 'lang-close': S.langOpen = false; return render();
    case 'lang': S.lang = id; S.langOpen = false; localStorage.setItem('syz_lang', id); return render();
    case 'dnd': {
      const on = !S.session.dnd;
      S.session.dnd = on;
      render();
      try { await api('/api/dnd', { method: 'POST', body: { on } }); } catch { S.session.dnd = !on; toast(t('errNetwork')); render(); }
      return;
    }
    case 'req': {
      S.requested.add(id);
      render();
      try { await api('/api/requests', { method: 'POST', body: { kind: id } }); } catch { S.requested.delete(id); toast(t('errNetwork')); render(); }
      return;
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.viewer) S.viewer = null;
  else if (S.langOpen) S.langOpen = false;
  else if (S.sheet) S.sheet = false;
  else return;
  render();
});

// ---------- 起動 ----------
render();
if (S.room) {
  loadAll().then(() => { if (justPaid) toast(t('thanksPaid')); });
  setInterval(refresh, 20_000);
  setInterval(refreshMenu, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); refreshMenu(); } });
}
