// スタッフ画面：注文・リクエスト・チャットの受付、精算、スマホへの通知
import { ALLERGENS, DISHES, DISH_CATS, dishByKey } from '../dishes.js';
const root = document.getElementById('root');
const dlg = document.getElementById('dlg');
const PIN_KEY = 'syz_staff_pin';
let pin = localStorage.getItem(PIN_KEY);
let board = null;
let seen = new Set(JSON.parse(localStorage.getItem('syz_staff_seen') || '[]'));
let firstLoad = true;
let chatRoom = null; // 開いている会話の部屋id
let chatDraft = '';

// 通知を受けたスマホ（サービスワーカー）がPINを使えるように、IndexedDB にも置く
function idb(fn) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('syz', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch { resolve(); }
  });
}
const savePinForPush = () => idb((st) => (pin ? st.put(pin, 'pin') : st.delete('pin')));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');
const hm = (iso) => new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
const ERRORS = {
  empty: 'メッセージを入力してください。',
  too_long: 'メッセージが長すぎます（1000文字まで）。',
  nothing_to_settle: '精算する注文がありません。',
  order_in_settlement: 'お支払い待ちの注文は取り消せません。「精算をやめる」で戻してから取り消してください。',
  not_pending: 'お支払い待ちの精算はありません。',
  square_error: 'Squareとの通信でエラーが出ました。',
  unauthorized: 'PINが違います。',
  name_required: '商品名を入れてください。',
  name_too_long: '商品名は60文字までです。',
  desc_too_long: '説明は300文字までです。',
  bad_price: '価格は0以上の整数（円）で入れてください。',
  bad_category: 'カテゴリを選んでください。',
  bad_stock: '在庫数は0以上の整数で入れてください。',
  price_locked: 'この商品は精算前の注文に入っているので、今は価格を変えられません。精算が済んでから変えてください。',
  item_in_use: 'この商品は精算前の注文に入っているので、今は掲載をやめられません。精算が済んでからにしてください。',
  bad_image: '写真は JPEG / PNG / GIF にしてください。',
  image_too_large: '写真が大きすぎます。',
  bad_slug: '詳細ページのURLは、英小文字・数字・ハイフン（-）で41文字までにしてください。',
  slug_taken: 'その詳細ページのURLは、ほかの商品が使っています。別のURLにしてください。',
  item_not_found: 'この商品が見つかりません。一覧を読み込み直してください。',
  staff_pin_not_set: 'サーバーにSTAFF_PINが設定されていません。'
};

async function api(path, opts = {}) {
  const res = await fetch('/staff/api' + path, {
    method: opts.method || 'GET',
    headers: { authorization: 'Bearer ' + pin, ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.removeItem(PIN_KEY);
    pin = null;
    renderLogin(ERRORS.unauthorized);
    throw new Error('unauthorized');
  }
  if (!res.ok) throw Object.assign(new Error(data.error), { code: data.error, detail: data.detail });
  return data;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
const fail = (e) => toast((ERRORS[e.code] || 'エラーが発生しました') + (e.detail ? `（${e.detail}）` : ''));

// 新着の注文・リクエストで音と振動
let audioCtx;
function chime() {
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.65);
  } catch {}
  navigator.vibrate?.([80, 60, 80]);
}

function renderLogin(msg = '') {
  root.innerHTML = `<div class="login"><div class="logo">小夜月<small>スタッフ</small></div>
    <input id="pin" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="PIN" aria-label="PIN">
    <label class="muted" style="display:flex;align-items:center;gap:8px"><input id="showpin" type="checkbox"> PINを表示する</label>
    <button class="b p" id="go">ログイン</button><div class="muted">${esc(msg)}</div></div>`;
  const go = () => {
    pin = document.getElementById('pin').value.trim();
    if (!pin) return;
    localStorage.setItem(PIN_KEY, pin);
    savePinForPush();
    load();
  };
  document.getElementById('go').onclick = go;
  // onkeydownで false を返すと文字入力そのものが取り消されるので、Enterのときだけ処理する
  document.getElementById('pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) go();
  });
  document.getElementById('showpin').onchange = (e) => {
    document.getElementById('pin').type = e.target.checked ? 'text' : 'password';
  };
}

async function load() {
  try {
    board = await api('/board');
  } catch (e) {
    if (e.message !== 'unauthorized') toast('読み込みに失敗しました');
    return;
  }
  // お客様からの未読メッセージも「新着」として音を鳴らす
  const chatIds = board.rooms.filter((r) => r.chat && r.chat.unread && r.chat.last.from === 'guest').map((r) => r.chat.last.id);
  const ids = [...board.orders.map((o) => o.id), ...board.requests.map((r) => r.id), ...chatIds];
  const fresh = ids.filter((id) => !seen.has(id));
  if (fresh.length && !firstLoad) chime();
  firstLoad = false;
  render(new Set(fresh));
  ids.forEach((id) => seen.add(id));
  localStorage.setItem('syz_staff_seen', JSON.stringify([...seen].slice(-500)));
}

function render(fresh = new Set()) {
  const b = board;
  const orders = b.orders.length
    ? b.orders
        .map(
          (o) => `<div class="item${fresh.has(o.id) ? ' new' : ''}">
        <div class="row"><span class="room">${esc(o.room)}</span><span class="muted">${hm(o.created_at)}・${o.delivery === 'hand' ? '<b>手渡し</b>' : '扉前（ノックなし）'}</span></div>
        <ul class="lines">${o.lines.map((l) => `<li>${esc(l.name)} × ${l.qty}</li>`).join('')}</ul>
        <div class="row"><b>${yen(o.total)}</b><div class="btns"><button class="b d" data-act="cancel" data-id="${o.id}">取消</button><button class="b p" data-act="deliver" data-id="${o.id}">お届け完了</button></div></div>
      </div>`
        )
        .join('')
    : '<div class="empty">未対応の注文はありません</div>';
  const reqs = b.requests.length
    ? b.requests
        .map(
          (r) => `<div class="item${fresh.has(r.id) ? ' new' : ''}"><div class="row"><span class="room">${esc(r.room)}</span><span class="muted">${hm(r.created_at)}</span></div>
        <div class="row"><span>${esc(r.label)}</span><button class="b p" data-act="reqdone" data-id="${r.id}">対応済み</button></div></div>`
        )
        .join('')
    : '<div class="empty">未対応のリクエストはありません</div>';
  const rooms = b.rooms.length
    ? b.rooms
        .map((s) => {
          const tags = `${s.payUrl ? '<span class="tag w">お支払い待ち</span>' : ''}${s.dnd ? ' <span class="tag w">起こさないで</span>' : ''}`;
          const btns = s.payUrl
            ? `<button class="b p" data-act="payqr" data-id="${s.id}">支払いQR</button><button class="b" data-act="verify" data-id="${s.id}">支払いを確認</button><button class="b" data-act="reopen" data-id="${s.id}">精算をやめる</button><button class="b" data-act="settle" data-id="${s.id}">現金で受領済み</button>`
            : s.unsettled > 0
              ? `<button class="b p" data-act="checkout" data-id="${s.id}">精算する</button><button class="b" data-act="settle" data-id="${s.id}">現金で受領済み</button>`
              : '';
          const amount = s.payUrl ? `お支払い待ち <b>${yen(s.pendingTotal)}</b>${s.unsettled ? `（このあとの注文 ${yen(s.unsettled)}）` : ''}` : `未精算 <b>${yen(s.unsettled)}</b>`;
          return `<div class="item"><div class="row"><span class="room">${esc(s.name)}</span><span>${tags}</span></div>
          <div class="row"><span>${amount}</span></div>
          <div class="btns">${btns}</div></div>`;
        })
        .join('')
    : '<div class="empty">客室が登録されていません。</div>';

  const threads = b.rooms
    .filter((r) => r.chat)
    .sort((x, y) => (y.chat.last.at > x.chat.last.at ? 1 : -1));
  const unreadTotal = threads.reduce((a, r) => a + r.chat.unread, 0);
  const chats = threads.length
    ? threads
        .map(
          (r) => `<button class="item thread${r.chat.unread ? ' new' : ''}" data-act="chat" data-id="${r.id}">
        <div class="row"><span class="room">${esc(r.name)}</span><span class="muted">${hm(r.chat.last.at)}${r.chat.unread ? ` <span class="badge">${r.chat.unread}</span>` : ''}</span></div>
        <span class="preview">${r.chat.last.from === 'staff' ? 'あなた：' : ''}${esc(r.chat.last.text)}</span></button>`
        )
        .join('')
    : '<div class="empty">お客様からのメッセージはまだありません</div>';

  root.innerHTML = `<div class="wrap">
    <header><div class="logo">小夜月<small>スタッフ</small> ${b.mock ? '<span class="pill">モック動作中（Square未接続）</span>' : ''}</div>
      <div class="btns"><button class="b" data-act="push">${pushLabel()}</button><button class="b" data-act="refresh">更新</button><button class="b" data-act="menu-open">メニュー</button><button class="b" data-act="logout">ログアウト</button></div></header>
    <section style="margin-bottom:16px"><h2>チャット <span class="n${unreadTotal ? ' hot' : ''}">${unreadTotal}</span></h2>${chats}</section>
    <div class="grid">
      <section><h2>新しい注文 <span class="n">${b.orders.length}</span></h2>${orders}</section>
      <section><h2>リクエスト <span class="n">${b.requests.length}</span></h2>${reqs}</section>
    </div>
    <section style="margin-top:16px"><div class="row"><h2>客室 <span class="n">${b.rooms.length}</span></h2></div>${rooms}</section>
  </div>`;
}

// ---------- チャット ----------
const LANG_NAME = { ja: '日本語', en: '英語', zht: '中国語（繁体字）', zhs: '中国語（簡体字）', ko: '韓国語' };

async function openChat(id) {
  chatRoom = id;
  chatDraft = '';
  dlg.classList.add('chat-dlg');
  dlg.innerHTML = '<div class="empty">読み込み中…</div>';
  if (!dlg.open) dlg.showModal();
  await refreshChatView(true);
}

async function refreshChatView(scroll = false) {
  if (!chatRoom || !dlg.open) return;
  const d = await api(`/chat/${chatRoom}`);
  const ta = dlg.querySelector('textarea');
  const focused = ta && document.activeElement === ta;
  const list = dlg.querySelector('.msgs');
  const nearBottom = !list || list.scrollTop + list.clientHeight >= list.scrollHeight - 60;
  const guestLang = [...d.messages].reverse().find((m) => m.from === 'guest')?.lang;
  const msgs = d.messages
    .map((m) => {
      const mine = m.from === 'staff';
      const orig = m.original ? `<span class="orig">原文（${esc(LANG_NAME[m.lang] || m.lang)}）：${esc(m.original)}</span>` : '';
      return `<div class="msg ${mine ? 'me' : 'them'}"><div class="bubble">${esc(m.text)}${orig}</div><span class="meta">${hm(m.at)}</span></div>`;
    })
    .join('');
  const note = guestLang && guestLang !== 'ja' ? `日本語で返信すると、${esc(LANG_NAME[guestLang])}に自動で訳してお客様に届きます。` : '日本語でそのまま返信できます。';
  dlg.innerHTML = `<div class="chat-head"><button class="b" data-act="close" aria-label="閉じる">← 戻る</button><span class="room">${esc(d.room.name)}</span>
      <button class="b" data-act="chat-close" data-id="${esc(d.room.id)}">会話を終える</button></div>
    <div class="msgs">${msgs || '<div class="empty">まだメッセージはありません</div>'}</div>
    <form class="composer" data-form="chat"><textarea rows="2" maxlength="1000" placeholder="返信を入力" aria-label="返信を入力">${esc(chatDraft)}</textarea><button type="submit" class="b p">送信</button></form>
    <p class="muted note">${note}</p>`;
  const nl = dlg.querySelector('.msgs');
  if (scroll || nearBottom) nl.scrollTop = nl.scrollHeight;
  const nta = dlg.querySelector('textarea');
  if (focused) { nta.focus(); nta.setSelectionRange(nta.value.length, nta.value.length); }
}

async function sendChat(form) {
  const text = chatDraft.trim();
  if (!text) return;
  const btn = form.querySelector('button');
  btn.disabled = true;
  try {
    await api(`/chat/${chatRoom}`, { method: 'POST', body: { text } });
    chatDraft = '';
    await refreshChatView(true);
  } catch (e) {
    btn.disabled = false;
    if (e.message !== 'unauthorized') fail(e);
  }
}

dlg.addEventListener('input', (e) => { if (e.target.matches('.composer textarea')) chatDraft = e.target.value; });
dlg.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-form="chat"]')) return;
  e.preventDefault();
  sendChat(e.target);
});
dlg.addEventListener('close', () => {
  dlg.classList.remove('chat-dlg', 'menu-dlg');
  menuData = null;
  if (chatRoom) { chatRoom = null; load(); }
});

// ---------- メニューの管理 ----------
let menuData = null; // { categories, items, held, mock }
let menuEditId = null; // 編集中の商品（null = 新規）
const TR_LANGS = [['en', '英語'], ['zht', '中国語（繁体字）'], ['zhs', '中国語（簡体字）'], ['ko', '韓国語']];

async function openMenu() {
  dlg.classList.add('menu-dlg');
  dlg.innerHTML = '<div class="empty" style="padding:24px">読み込み中…</div>';
  if (!dlg.open) dlg.showModal();
  menuData = await api('/menu');
  showMenuList();
}

function itemStatus(i) {
  const held = menuData.held[i.id] || 0;
  const tags = [];
  if (i.draft) tags.push('<span class="tag w">下書き</span>');
  if (i.paused) tags.push('<span class="tag w">一時停止中</span>');
  else if (i.tracked) {
    const left = Math.max(0, (i.stock || 0) - held);
    tags.push(left > 0 ? `<span class="tag">残り ${left}</span>` : '<span class="tag w">売り切れ（残り0）</span>');
  } else if (i.soldOut) tags.push('<span class="tag w">売り切れ（Square）</span>');
  else tags.push('<span class="tag">掲載中</span>');
  return tags.join(' ');
}

// ---------- 下書き ----------
// 下書きの商品はお客様の画面に出ず、注文も受けない。「公開」でお客様に見えるようにする。
// 用意してある紹介（public/dishes.js）で、まだ Square に無い品も「Squareに未登録」の下書きとして並べる
const CAT_NAME = { dinner: '夕食', breakfast: '朝食', drink: '飲み物', sweet: 'お菓子' };
const seeds = () => DISHES.filter((s) => !menuData.items.some((i) => i.name === s.key) && !menuData.categories.every((c) => c.name !== CAT_NAME[s.cat]));
const previewUrl = (slug) => `/menu/${encodeURIComponent(slug)}`;
let seedEdit = null; // 編集中の未登録の下書き（slug）

/** 未登録の下書き → 新規の商品（Square には「公開」か「下書き保存」を押したときに入れる） */
function seedItem(s) {
  return {
    name: s.key,
    desc: s.portion?.ja || '',
    price: s.price ?? '',
    category: CAT_NAME[s.cat],
    names: s.name?.en ? { en: s.name.en } : {},
    descs: s.portion?.en ? { en: s.portion.en } : {},
    seed: s
  };
}

function draftSection() {
  const d = menuData;
  const rows = [
    ...d.items.filter((i) => i.draft).map((i) => {
      const slug = i.detail?.slug || dishByKey(i.name)?.slug;
      const thumb = i.images[0]?.url || dishByKey(i.name)?.photos?.[0];
      return `<div class="item mitem drow"><button class="dmain" data-act="menu-edit" data-id="${esc(i.itemId)}">
          <span class="thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : '<span class="noimg">写真なし</span>'}</span>
          <span class="minfo"><span class="mname">${esc(i.name)}</span><span class="muted">${esc(i.category)}・${yen(i.price)}</span></span></button>
        <span class="dbtns">${slug ? `<a class="b" href="${previewUrl(slug)}" target="_blank" rel="noopener">プレビュー</a>` : ''}<button class="b p" data-act="menu-publish" data-id="${esc(i.itemId)}">公開</button></span></div>`;
    }),
    ...seeds().map(
      (s) => `<div class="item mitem drow"><button class="dmain" data-act="seed-edit" data-id="${esc(s.slug)}">
          <span class="thumb">${s.photos?.[0] ? `<img src="${esc(s.photos[0])}" alt="" loading="lazy">` : '<span class="noimg">写真なし</span>'}</span>
          <span class="minfo"><span class="mname">${esc(s.key)}</span><span class="muted">${esc(CAT_NAME[s.cat] || '')}${s.price != null ? '・' + yen(s.price) : ''}</span><span><span class="tag w">Squareに未登録</span></span></span></button>
        <span class="dbtns"><a class="b" href="${previewUrl(s.slug)}" target="_blank" rel="noopener">プレビュー</a><button class="b p" data-act="seed-publish" data-id="${esc(s.slug)}">公開</button></span></div>`
    )
  ];
  return `<section class="mgroup"><h2>下書き <span class="n">${rows.length}</span></h2>
    <p class="muted">お客様には見えません。「プレビュー」で詳細ページを確かめて、「公開」でお客様の画面に出ます。</p>
    ${rows.length ? rows.join('') : '<div class="empty">下書きはありません</div>'}</section>`;
}

function showMenuList() {
  menuEditId = null;
  seedEdit = null;
  const d = menuData;
  const groups = d.categories
    .map((c) => {
      const items = d.items.filter((i) => i.category === c.name && !i.draft);
      const cards = items.length
        ? items
            .map(
              (i) => `<button class="item mitem" data-act="menu-edit" data-id="${esc(i.itemId)}">
          <span class="thumb">${i.images[0] ? `<img src="${esc(i.images[0].url)}" alt="" loading="lazy">` : '<span class="noimg">写真なし</span>'}</span>
          <span class="minfo"><span class="mname">${esc(i.name)}</span><span class="muted">${esc(i.desc)}</span><span>${itemStatus(i)}</span></span>
          <span class="mprice">${yen(i.price)}</span></button>`
            )
            .join('')
        : '<div class="empty">このカテゴリの商品はありません</div>';
      return `<section class="mgroup"><h2>${esc(c.name)} <span class="n">${items.length}</span>${c.cutoff ? `<span class="muted" style="font-weight:400">当日${esc(c.cutoff)}締め</span>` : ''}</h2>${cards}</section>`;
    })
    .join('');
  dlg.innerHTML = `<div class="chat-head"><button class="b" data-act="close">← 戻る</button><span class="room">メニュー</span><button class="b p" data-act="menu-new">＋ 追加</button></div>
    <div class="mbody">${d.mock ? '<p class="muted">モック動作中：変更はこの環境のデータベースにだけ入ります。</p>' : ''}${draftSection()}${groups}
    <p class="muted">ここでの変更は Square の商品にそのまま入り、お客様の画面には数十秒以内に出ます。</p></div>`;
}

function trFields(kind, label, values) {
  return `<fieldset class="trset"><legend>${label}</legend>${TR_LANGS.map(
    ([l, n]) => `<label>${n}<input name="${kind}_${l}" value="${esc(values?.[l] || '')}" maxlength="300" data-tr="${kind}_${l}"></label>`
  ).join('')}</fieldset>`;
}

// ---------- 詳細ページ（お客様が商品をタップしたときの紹介・/menu/<URL>） ----------
const DETAIL_TEXT = [
  ['kicker', 'ひとこと（料理名の下に出るキャッチ）', 60, 'input', '部屋で炊く山形牛の割下鍋'],
  ['story', '紹介文', 600, 'textarea', '料理の魅力・食べ方・産地など'],
  ['contents', '内容（1行に1つ）', 1000, 'textarea', '山形牛（すき焼き用）\n焼き豆腐・白菜・春菊'],
  ['serve', 'お届け', 60, 'input', '18:00〜19:30 のお好きな時間'],
  ['portion', '量', 30, 'input', '2人前'],
  ['note', '補足（注意書きなど）', 200, 'input', '事前予約制です']
];
let detailOrig = {}; // 開いたときの日本語・英語（日本語を直して英語をそのままにしたら、英語は訳し直す）

/** 保存済みの詳細 → 画面の値。まだ無ければ public/dishes.js に書いてある分を初期値にする */
function detailValues(i) {
  const d = i?.detail;
  if (i?.seed) {
    const s = i.seed;
    return { on: true, slug: s.slug, allergens: s.allergens || [], v: (f, l) => (f === 'contents' ? (s.contents || []).map((c) => c[l] || '').join('\n') : s[f]?.[l] || '') };
  }
  if (d) return { on: true, slug: d.slug, allergens: d.allergens || [], v: (f, l) => (f === 'contents' ? (d.contents?.[l] || []).join('\n') : d[f]?.[l] || '') };
  const s = i ? dishByKey(i.name) : null;
  if (s)
    return {
      on: false, slug: s.slug, allergens: s.allergens || [], fromFile: true,
      v: (f, l) => (f === 'contents' ? (s.contents || []).map((c) => c[l] || '').join('\n') : s[f]?.[l] || '')
    };
  return { on: false, slug: '', allergens: [], v: () => '' };
}

function detailFields(i) {
  const x = detailValues(i);
  detailOrig = {};
  const field = ([f, label, max, kind, ph], l) => {
    const val = x.v(f, l);
    detailOrig[`${f}_${l}`] = val;
    const attrs = `name="d_${f}_${l}" maxlength="${max}" placeholder="${l === 'ja' ? esc(ph) : '空欄なら日本語から訳します'}"`;
    return `<label>${label}${kind === 'textarea' ? `<textarea ${attrs} rows="${f === 'story' ? 4 : 3}">${esc(val)}</textarea>` : `<input ${attrs} value="${esc(val)}">`}</label>`;
  };
  const link = i?.detail ? `<a class="b" href="/menu/${encodeURIComponent(i.detail.slug)}" target="_blank" rel="noopener">詳細ページを開く ↗</a>` : '';
  return `<h3>詳細ページ</h3>
    <label class="chk"><input type="checkbox" name="d_on"${x.on ? ' checked' : ''}> 詳細ページを作る</label>
    <p class="muted">お客様が商品をタップしたときの紹介と、URLで共有できるページ。写真は上の商品写真を使います。一時停止中でもURLを開けば見られるので、公開前の下見に使えます。${x.fromFile && !x.on ? '<br>用意してある文章を入れてあります。チェックを入れて保存すると使われます。' : ''}</p>
    <div class="dfields"${x.on ? '' : ' hidden'}>
      <label>URL（英小文字・数字・ハイフン。空欄なら英語名から作ります）<span class="slug"><span>/menu/</span><input name="d_slug" value="${esc(x.slug)}" maxlength="41" pattern="[a-z0-9][a-z0-9\\-]*" autocapitalize="off" spellcheck="false"></span></label>
      ${DETAIL_TEXT.map((d) => field(d, 'ja')).join('')}
      <fieldset class="trset"><legend>アレルゲン</legend><div class="alg">${Object.entries(ALLERGENS)
        .map(([k, n]) => `<label class="chk"><input type="checkbox" name="d_alg" value="${k}"${x.allergens.includes(k) ? ' checked' : ''}> ${esc(n.ja)}</label>`)
        .join('')}</div></fieldset>
      <details class="trset"><summary>英語（空欄は保存のときに日本語から訳します。中国語・韓国語の画面にも英語で出ます）</summary>
        ${DETAIL_TEXT.map((d) => field(d, 'en')).join('')}</details>
      ${link}
    </div>`;
}

function detailBody(f) {
  if (!f.elements.d_on.checked) return null;
  const v = (n) => f.elements[n].value.trim();
  const out = { slug: v('d_slug').toLowerCase(), allergens: [...f.querySelectorAll('[name="d_alg"]:checked')].map((x) => x.value) };
  for (const [k] of DETAIL_TEXT) {
    const ja = v(`d_${k}_ja`);
    let en = v(`d_${k}_en`);
    // 日本語を直したのに英語が開いたときのままなら、古い英語は捨てて訳し直す
    if (ja !== detailOrig[`${k}_ja`] && en === detailOrig[`${k}_en`]) en = '';
    out[k] = k === 'contents' ? { ja: ja.split('\n'), en: en ? en.split('\n') : [] } : { ja, en };
  }
  return out;
}

function showMenuEdit(itemId, seedSlug = null) {
  const seed = seedSlug ? DISHES.find((s) => s.slug === seedSlug) : null;
  const i = seed ? seedItem(seed) : itemId ? menuData.items.find((x) => x.itemId === itemId) : null;
  if ((itemId || seedSlug) && !i) return showMenuList();
  menuEditId = seed ? null : itemId;
  seedEdit = seed ? seed.slug : null;
  const isNew = !menuEditId;
  const cats = menuData.categories.map((c) => `<option${(i ? i.category : menuData.categories[0].name) === c.name ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const held = i ? menuData.held[i.id] || 0 : 0;
  const photos = seed
    ? `<div class="photos">${(seed.photos || []).map((u) => `<div class="ph"><img src="${esc(u)}" alt=""></div>`).join('')}</div><p class="muted">この写真は、Square に入れるときに一緒に登録します。</p>`
    : !isNew
    ? `<div class="photos">${i.images
        .map(
          (img, n) => `<div class="ph"><img src="${esc(img.url)}" alt="">${n === 0 ? '<span class="tag">1枚目（一覧に出る）</span>' : `<button type="button" class="b" data-act="menu-img-first" data-img="${esc(img.id)}">1枚目にする</button>`}<button type="button" class="b d" data-act="menu-img-remove" data-img="${esc(img.id)}">外す</button></div>`
        )
        .join('')}<label class="b addph">＋ 写真を追加<input type="file" accept="image/*" multiple hidden data-upload></label></div>`
    : '<p class="muted">写真は、保存したあとに追加できます。</p>';
  dlg.innerHTML = `<div class="chat-head"><button class="b" data-act="menu-list">← 一覧</button><span class="room">${isNew ? (seed ? '下書き（Squareに未登録）' : '商品を追加') : i.draft ? '下書きを編集' : '商品を編集'}</span><span></span></div>
    <form class="mbody medit" data-form="menu">
      <label>商品名（日本語）<input name="name" required maxlength="60" value="${esc(i?.name || '')}"></label>
      <label>説明（日本語・任意）<textarea name="desc" rows="2" maxlength="300">${esc(i?.desc || '')}</textarea></label>
      <div class="two"><label>価格（円・税込）<input name="price" type="number" inputmode="numeric" min="0" step="1" required value="${i ? i.price : ''}"></label>
      <label>カテゴリ<select name="category">${cats}</select></label></div>
      <label class="chk"><input type="checkbox" name="tracked"${i?.tracked ? ' checked' : ''}> 数を決めて売る（在庫を数える）</label>
      <label class="stockrow"${i?.tracked ? '' : ' hidden'}>いまの在庫数<input name="stock" type="number" inputmode="numeric" min="0" step="1" value="${i?.tracked ? i.stock ?? 0 : ''}">
        <span class="muted">${held ? `精算前の注文で ${held} 個押さえ中。お客様には「在庫数 − ${held}」が残りとして出ます。` : '0にすると売り切れになります。'}</span></label>
      <label class="chk"><input type="checkbox" name="paused"${i?.paused ? ' checked' : ''}> 一時停止（お客様の画面では「売り切れ」）</label>
      <h3>写真</h3>${photos}
      ${detailFields(i)}
      <h3>ほかの言語</h3>
      <p class="muted">空欄は保存のときに日本語から自動で訳します。直した訳はそのまま使います。</p>
      ${trFields('names', '商品名', i?.names)}${trFields('descs', '説明', i?.descs)}
      <button type="button" class="b" data-act="menu-tr">日本語から訳し直す</button>
      ${!isNew ? `<p class="muted">${i.draft ? 'いまは下書きです（お客様には見えません）。' : 'いまはお客様に公開しています。'}</p>` : ''}
      <div class="mactions">${!isNew ? '<button type="button" class="b d" data-act="menu-archive">掲載をやめる</button>' : '<span></span>'}${
        isNew
          ? '<button type="submit" class="b" data-publish="0">下書き保存</button><button type="submit" class="b p" data-publish="1">保存して公開</button>'
          : i.draft
            ? '<button type="submit" class="b">保存</button><button type="button" class="b p" data-act="menu-publish" data-id="' + esc(i.itemId) + '">公開</button>'
            : '<button type="button" class="b" data-act="menu-unpublish" data-id="' + esc(i.itemId) + '">下書きに戻す</button><button type="submit" class="b p">保存</button>'
      }</div>
    </form>`;
  const f = dlg.querySelector('[data-form="menu"]');
  f.dataset.origName = i?.name || '';
  f.dataset.origDesc = i?.desc || '';
  dlg.scrollTop = 0;
  dlg.querySelector('.mbody').scrollTop = 0;
}

function formBody(f) {
  const v = (n) => f.elements[n].value;
  const touched = (n) => f.querySelector(`[data-tr="${n}"]`)?.dataset.touched === '1';
  const tr = (kind, changed) =>
    Object.fromEntries(TR_LANGS.map(([l]) => [l, changed && !touched(`${kind}_${l}`) ? '' : v(`${kind}_${l}`).trim()]));
  const tracked = f.elements.tracked.checked;
  return {
    name: v('name').trim(),
    desc: v('desc').trim(),
    price: Number(v('price')),
    category: v('category'),
    tracked,
    stock: tracked && v('stock') !== '' ? Number(v('stock')) : null,
    paused: f.elements.paused.checked,
    // 日本語を変えたのに訳を手で直していなければ、古い訳は捨てて訳し直す
    names: tr('names', v('name').trim() !== f.dataset.origName),
    descs: tr('descs', v('desc').trim() !== f.dataset.origDesc),
    detail: detailBody(f)
  };
}

async function saveMenu(f, submitter) {
  const btn = submitter || f.querySelector('button[type="submit"]');
  const label = btn.textContent;
  const publish = btn.dataset.publish === '1';
  f.querySelectorAll('button[type="submit"]').forEach((b) => (b.disabled = true));
  btn.textContent = '保存中…';
  try {
    const body = formBody(f);
    if (!menuEditId) {
      body.publish = publish;
      const seed = seedEdit && DISHES.find((s) => s.slug === seedEdit);
      if (seed) body.seedPhotos = seed.photos || [];
      const r = await api('/menu', { method: 'POST', body });
      menuData = r;
      toast(publish ? '公開しました。お客様の画面に出ます' : '下書きに保存しました。お客様には見えません');
      return showMenuEdit(r.id);
    }
    if (menuEditId) {
      menuData = await api(`/menu/${menuEditId}`, { method: 'PUT', body });
      toast('保存しました');
      showMenuEdit(menuEditId);
    } else {
      const r = await api('/menu', { method: 'POST', body });
      menuData = r;
      toast('追加しました。写真を追加できます');
      showMenuEdit(r.id);
    }
  } catch (e) {
    f.querySelectorAll('button[type="submit"]').forEach((b) => (b.disabled = false));
    btn.textContent = label;
    if (e.message !== 'unauthorized') fail(e);
  }
}

/** 下書き ⇄ 公開（一覧の「公開」ボタン・編集画面の「公開」「下書きに戻す」） */
async function setPublished(el, publish) {
  const i = menuData.items.find((x) => x.itemId === el.dataset.id);
  if (!i) return;
  if (!confirm(publish ? `「${i.name}」を公開しますか？\nお客様の注文画面と /menu に出ます。` : `「${i.name}」を下書きに戻しますか？\nお客様の画面から消えます。`)) return;
  el.disabled = true;
  try {
    menuData = await api(`/menu/${i.itemId}/${publish ? 'publish' : 'unpublish'}`, { method: 'POST' });
    toast(publish ? '公開しました' : '下書きに戻しました');
    menuEditId ? showMenuEdit(menuEditId) : showMenuList();
  } catch (e) {
    el.disabled = false;
    if (e.message !== 'unauthorized') fail(e);
  }
}

/** 未登録の下書きを、用意してある紹介のまま Square に入れて公開する（スマホの一覧から1回で） */
async function publishSeed(el) {
  const s = DISHES.find((x) => x.slug === el.dataset.id);
  if (!s) return;
  if (s.price == null) return showMenuEdit(null, s.slug); // 価格が決まっていなければ編集画面で入れる
  if (!confirm(`「${s.key}」を ${yen(s.price)} で公開しますか？\nSquare に商品を作り、お客様の注文画面と /menu に出ます。価格などはあとから直せます。`)) return;
  el.disabled = true;
  el.textContent = '公開中…';
  const t = (o) => ({ ja: o?.ja || '', en: o?.en || '' });
  const body = {
    ...seedItem(s),
    seed: undefined,
    tracked: false,
    stock: null,
    paused: false,
    publish: true,
    seedPhotos: s.photos || [],
    detail: {
      slug: s.slug,
      kicker: t(s.kicker), story: t(s.story), serve: t(s.serve), portion: t(s.portion), note: t(s.note),
      contents: { ja: (s.contents || []).map((c) => c.ja), en: (s.contents || []).map((c) => c.en || '') },
      allergens: s.allergens || []
    }
  };
  try {
    menuData = await api('/menu', { method: 'POST', body });
    toast('公開しました');
    showMenuList();
  } catch (e) {
    el.disabled = false;
    el.textContent = '公開';
    if (e.message !== 'unauthorized') fail(e);
  }
}

async function retranslate(el) {
  const f = el.closest('form');
  el.disabled = true;
  el.textContent = '訳しています…';
  try {
    const r = await api('/menu/translate', { method: 'POST', body: { name: f.elements.name.value, desc: f.elements.desc.value } });
    for (const [l] of TR_LANGS) {
      f.elements[`names_${l}`].value = r.names[l] || '';
      f.elements[`descs_${l}`].value = r.descs[l] || '';
    }
    f.querySelectorAll('[data-tr]').forEach((x) => (x.dataset.touched = '1'));
    toast('訳を入れました。保存すると反映されます');
  } finally {
    el.disabled = false;
    el.textContent = '日本語から訳し直す';
  }
}

async function archiveMenu(el) {
  const i = menuData.items.find((x) => x.itemId === menuEditId);
  if (!i || !confirm(`「${i.name}」の掲載をやめますか？\nお客様の画面から消えます。Square ではアーカイブになるので、Squareの管理画面から戻せます。`)) return;
  el.disabled = true;
  menuData = await api(`/menu/${menuEditId}/archive`, { method: 'POST' });
  toast('掲載をやめました');
  showMenuList();
}

async function imageOp(el, op) {
  if (op === 'remove' && !confirm('この写真を外しますか？')) return;
  el.disabled = true;
  const img = el.dataset.img;
  menuData = await api(`/menu/${menuEditId}/images/${img}${op === 'first' ? '/first' : ''}`, { method: op === 'first' ? 'POST' : 'DELETE' });
  showMenuEdit(menuEditId);
}

// スマホの写真は大きいので、長い辺1600pxのJPEGに縮めてから送る
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k);
      c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('shrink'))), 'image/jpeg', 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error('bad_image'), { code: 'bad_image' })); };
    im.src = url;
  });
}

async function uploadPhotos(input) {
  const files = [...input.files];
  if (!files.length) return;
  const label = input.closest('.addph');
  label.classList.add('busy');
  label.firstChild.textContent = `アップロード中…（${files.length}枚）`;
  try {
    for (const file of files) {
      const blob = await shrink(file);
      const res = await fetch(`/staff/api/menu/${menuEditId}/images`, { method: 'POST', headers: { authorization: 'Bearer ' + pin, 'content-type': 'image/jpeg' }, body: blob });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error), { code: data.error, detail: data.detail });
      menuData = data;
    }
    toast('写真を追加しました');
  } catch (e) {
    fail(e);
  }
  showMenuEdit(menuEditId);
}

dlg.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-form="menu"]')) return;
  e.preventDefault();
  saveMenu(e.target, e.submitter);
});
dlg.addEventListener('change', (e) => {
  if (e.target.matches('[data-upload]')) return uploadPhotos(e.target);
  if (e.target.name === 'tracked') dlg.querySelector('.stockrow').hidden = !e.target.checked;
  if (e.target.name === 'd_on') dlg.querySelector('.dfields').hidden = !e.target.checked;
});
dlg.addEventListener('input', (e) => { if (e.target.dataset.tr) e.target.dataset.touched = '1'; });

// ---------- スマホへの通知 ----------
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let pushOn = localStorage.getItem('syz_push') === '1';
const pushLabel = () => (pushOn ? '通知：オン' : '通知をオンにする');

const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function enablePush() {
  if (!pushSupported() || (isIOS() && !standalone())) {
    dlg.innerHTML = `<div class="howto"><h2>スマホに通知を出すには</h2>
      ${isIOS()
        ? `<ol><li>Safariでこのスタッフ画面を開いた状態で、画面下の<b>共有ボタン（□に↑）</b>を押す</li><li>「<b>ホーム画面に追加</b>」を押し、右上の「追加」を押す</li><li>ホーム画面にできた「小夜月 スタッフ」のアイコンから開き、PINでログインする</li><li>上の「<b>通知をオンにする</b>」を押し、「許可」を押す</li></ol><p class="muted">iPhoneはiOS 16.4以降で、ホーム画面に追加したときだけ通知を受け取れます。</p>`
        : '<p>このブラウザは通知に対応していません。Chromeで開き直してください。</p>'}
      </div><div class="btns" style="justify-content:center;margin-top:12px"><button class="b p" data-act="close">閉じる</button></div>`;
    return dlg.showModal();
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return toast('通知が許可されませんでした。スマホの設定から通知を許可してください。');
  const reg = await navigator.serviceWorker.register('/staff/sw.js', { scope: '/staff/' });
  await navigator.serviceWorker.ready;
  const { key } = await api('/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api('/push/subscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
  await savePinForPush();
  pushOn = true;
  localStorage.setItem('syz_push', '1');
  await api('/push/test', { method: 'POST' });
  toast('通知をオンにしました。テスト通知を送りました。');
  render();
}

async function disablePush() {
  if (!confirm('このスマホへの通知をオフにしますか？')) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/staff/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
  } catch {}
  pushOn = false;
  localStorage.removeItem('syz_push');
  toast('通知をオフにしました');
  render();
}

const qrSvg = (url) => {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
};
function showQr(name, url) {
  const body = `<div class="qr"><div class="room">${esc(name)} お支払い</div>${qrSvg(url)}<div class="langs">ゲストのスマホで読み取ってお支払いいただけます。<br>ゲストの画面の「お会計」タブにも支払いボタンが出ています。</div></div>`;
  dlg.innerHTML = `${body}<div class="btns noprint" style="justify-content:center;margin-top:12px"><button class="b" data-act="copy" data-url="${esc(url)}">URLをコピー</button><button class="b p" data-act="close">閉じる</button></div>`;
  dlg.showModal();
}

// 触ったところに光が広がる
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('pointerdown', (e) => {
  if (calm.matches || !e.target.closest('button')) return;
  const b = document.createElement('span');
  b.className = 'tap-bloom';
  b.style.left = e.clientX + 'px';
  b.style.top = e.clientY + 'px';
  document.body.appendChild(b);
  b.addEventListener('animationend', () => b.remove());
}, { passive: true });

// 対応済みのカードを右へはじき出してから消す
const flick = (el) =>
  new Promise((r) => {
    const card = el.closest('.item');
    if (!card || calm.matches) return r();
    card.classList.add('done-out');
    setTimeout(r, 420);
  });

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act, id } = el.dataset;
  const room = board?.rooms.find((s) => s.id === id);
  try {
    switch (act) {
      case 'refresh': return load();
      case 'logout': localStorage.removeItem(PIN_KEY); pin = null; savePinForPush(); return renderLogin();
      case 'chat': return openChat(id);
      case 'chat-close': {
        if (!confirm('この部屋の会話を終えますか？（お客様がチェックアウトしたとき用。次のお客様には見えなくなります）')) return;
        await api(`/chat/${id}/close`, { method: 'POST' });
        dlg.close();
        return toast('会話を終えました');
      }
      case 'push': return pushOn ? disablePush() : enablePush();
      case 'menu-open': return openMenu();
      case 'menu-list': return showMenuList();
      case 'menu-new': return showMenuEdit(null);
      case 'menu-edit': return showMenuEdit(id);
      case 'seed-edit': return showMenuEdit(null, id);
      case 'menu-publish': return setPublished(el, true);
      case 'menu-unpublish': return setPublished(el, false);
      case 'seed-publish': return publishSeed(el);
      case 'menu-tr': return retranslate(el);
      case 'menu-archive': return archiveMenu(el);
      case 'menu-img-first': return imageOp(el, 'first');
      case 'menu-img-remove': return imageOp(el, 'remove');
      case 'deliver': el.disabled = true; await api(`/orders/${id}/deliver`, { method: 'POST' }); await flick(el); return load();
      case 'cancel': if (!confirm('この注文を取り消しますか？')) return; await api(`/orders/${id}/cancel`, { method: 'POST' }); return load();
      case 'reqdone': el.disabled = true; await api(`/requests/${id}/done`, { method: 'POST' }); await flick(el); return load();
      case 'checkout': {
        if (!confirm(`${room.name} の未精算 ${yen(room.unsettled)} を精算します。Squareの支払いリンクを発行します。`)) return;
        el.disabled = true;
        const r = await api(`/rooms/${id}/checkout`, { method: 'POST' });
        await load();
        return showQr(room.name, r.payUrl);
      }
      case 'payqr': return showQr(room.name, room.payUrl);
      case 'verify': {
        el.disabled = true;
        const r = await api(`/rooms/${id}/verify`, { method: 'POST' });
        toast(r.paid ? `${room.name} のお支払いを確認しました` : 'まだSquareで支払いが済んでいません');
        return load();
      }
      case 'reopen': await api(`/rooms/${id}/reopen`, { method: 'POST' }); return load();
      case 'settle': if (!confirm('現金などで受け取り済みとして精算を完了しますか？')) return; await api(`/rooms/${id}/settle`, { method: 'POST' }); return load();
      case 'copy': await navigator.clipboard.writeText(el.dataset.url); return toast('コピーしました');
      case 'close': return dlg.close();
    }
  } catch (e) {
    if (e.message !== 'unauthorized') fail(e);
  }
});

if (pin) { savePinForPush(); load(); }
else renderLogin();
setInterval(() => pin && !dlg.open && load(), 10_000);
// 会話を開いているあいだは4秒ごとに新しいメッセージを見にいく
setInterval(() => pin && chatRoom && dlg.open && !document.hidden && refreshChatView().catch(() => {}), 4_000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !pin) return;
  if (chatRoom && dlg.open) refreshChatView().catch(() => {});
  else load();
});
// 通知を押して開いたとき（?chat=部屋id）は、その会話を開く
const openFromPush = new URLSearchParams(location.search).get('chat');
if (pin && openFromPush) { history.replaceState(null, '', '/staff/'); openChat(openFromPush).catch(() => {}); }
