// スタッフ画面：客室の登録と固定QR、注文とリクエストの受付、精算
const root = document.getElementById('root');
const dlg = document.getElementById('dlg');
const PIN_KEY = 'syz_staff_pin';
let pin = localStorage.getItem(PIN_KEY);
let board = null;
let seen = new Set(JSON.parse(localStorage.getItem('syz_staff_seen') || '[]'));
let firstLoad = true;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const yen = (n) => '¥' + Number(n || 0).toLocaleString('ja-JP');
const hm = (iso) => new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
const ERRORS = {
  room_exists: '同じ名前の客室がすでにあります。',
  room_has_bill: '未精算の注文があるため削除できません。先に精算してください。',
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
  const ids = [...board.orders.map((o) => o.id), ...board.requests.map((r) => r.id)];
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

  root.innerHTML = `<div class="wrap">
    <header><div class="logo">小夜月<small>スタッフ</small> ${b.mock ? '<span class="pill">モック動作中（Square未接続）</span>' : ''}</div>
      <div class="btns"><button class="b" data-act="refresh">更新</button><button class="b" data-act="menu">メニュー再読込</button><button class="b" data-act="logout">ログアウト</button></div></header>
    <div class="grid">
      <section><h2>新しい注文 <span class="n">${b.orders.length}</span></h2>${orders}</section>
      <section><h2>リクエスト <span class="n">${b.requests.length}</span></h2>${reqs}</section>
    </div>
    <section style="margin-top:16px"><div class="row"><h2>客室 <span class="n">${b.rooms.length}</span></h2></div>${rooms}</section>
  </div>`;
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

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act, id } = el.dataset;
  const room = board?.rooms.find((s) => s.id === id);
  try {
    switch (act) {
      case 'refresh': return load();
      case 'logout': localStorage.removeItem(PIN_KEY); pin = null; return renderLogin();
      case 'menu': await api('/menu/refresh', { method: 'POST' }); return toast('メニューを読み込み直しました');
      case 'deliver': el.disabled = true; await api(`/orders/${id}/deliver`, { method: 'POST' }); return load();
      case 'cancel': if (!confirm('この注文を取り消しますか？')) return; await api(`/orders/${id}/cancel`, { method: 'POST' }); return load();
      case 'reqdone': el.disabled = true; await api(`/requests/${id}/done`, { method: 'POST' }); return load();
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

if (pin) load();
else renderLogin();
setInterval(() => pin && !dlg.open && load(), 10_000);
document.addEventListener('visibilitychange', () => !document.hidden && pin && load());
