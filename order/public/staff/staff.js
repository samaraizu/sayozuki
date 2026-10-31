// スタッフ画面：注文・リクエスト・チャットの受付、精算、スマホへの通知
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
            ? `<button class="b p" data-act="payqr" data-id="${s.id}">支払いQR</button><button class="b" data-act="reopen" data-id="${s.id}">精算をやめる</button><button class="b" data-act="settle" data-id="${s.id}">現金で受領済み</button>`
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
      <div class="btns"><button class="b" data-act="push">${pushLabel()}</button><button class="b" data-act="refresh">更新</button><button class="b" data-act="menu">メニュー再読込</button><button class="b" data-act="logout">ログアウト</button></div></header>
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
  dlg.classList.remove('chat-dlg');
  if (chatRoom) { chatRoom = null; load(); }
});

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
      case 'menu': await api('/menu/refresh', { method: 'POST' }); return toast('メニューを読み込み直しました');
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
