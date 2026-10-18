// スタッフ画面：チェックイン（客室QR発行）・注文とリクエストの受付・精算・入湯税帳簿
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
  room_in_use: 'この部屋はまだ精算されていません。精算してからチェックインしてください。',
  stay_not_active: '精算手続き中のため操作できません。「精算をやめる」で戻せます。',
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
  if (opts.raw) {
    if (!res.ok) throw new Error('http ' + res.status);
    return res;
  }
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
    <button class="b p" id="go">ログイン</button><div class="muted">${esc(msg)}</div></div>`;
  const go = () => {
    pin = document.getElementById('pin').value.trim();
    if (!pin) return;
    localStorage.setItem(PIN_KEY, pin);
    load();
  };
  document.getElementById('go').onclick = go;
  document.getElementById('pin').onkeydown = (e) => e.key === 'Enter' && go();
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
  const month = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
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
          const st = s.status === 'checkout_pending' ? '<span class="tag w">お支払い待ち</span>' : '<span class="tag">滞在中</span>';
          const btns =
            s.status === 'active'
              ? `<button class="b" data-act="qr" data-id="${s.id}">客室QR</button><button class="b" data-act="edit" data-id="${s.id}">人数・泊数</button><button class="b p" data-act="checkout" data-id="${s.id}">精算する</button>`
              : `<button class="b p" data-act="payqr" data-id="${s.id}">支払いQR</button><button class="b" data-act="reopen" data-id="${s.id}">精算をやめる</button><button class="b" data-act="settle" data-id="${s.id}">現金で受領済み</button>`;
          return `<div class="item"><div class="row"><span class="room">${esc(s.room)}</span><span>${st}${s.dnd ? ' <span class="tag w">起こさないで</span>' : ''}</span></div>
          <div class="muted">課税${s.taxable}名・免除${s.exempt}名・${s.nights}泊（${esc(s.checkinDate)}〜）</div>
          <div class="row"><span>注文 ${yen(s.subtotal)} ＋ 入湯税 ${yen(s.bathTax)} ＝ <b>${yen(s.subtotal + s.bathTax)}</b></span></div>
          <div class="btns">${btns}</div></div>`;
        })
        .join('')
    : '<div class="empty">滞在中の客室はありません</div>';

  root.innerHTML = `<div class="wrap">
    <header><div class="logo">小夜月<small>スタッフ</small> ${b.mock ? '<span class="pill">モック動作中（Square未接続）</span>' : ''}</div>
      <div class="btns"><button class="b" data-act="refresh">更新</button><button class="b" data-act="menu">メニュー再読込</button><button class="b" data-act="logout">ログアウト</button></div></header>
    <div class="grid">
      <section><h2>新しい注文 <span class="n">${b.orders.length}</span></h2>${orders}</section>
      <section><h2>リクエスト <span class="n">${b.requests.length}</span></h2>${reqs}</section>
    </div>
    <div class="grid" style="margin-top:16px">
      <section><h2>チェックイン</h2>
        <form id="ci"><label>部屋番号<input name="room" required maxlength="20" placeholder="203"></label>
          <label>課税対象<input name="taxable" type="number" min="0" max="30" value="2" required></label>
          <label>免除（12歳未満など）<input name="exempt" type="number" min="0" max="30" value="0" required></label>
          <label>泊数<input name="nights" type="number" min="1" max="30" value="1" required></label>
          <button class="b p" type="submit">客室QRを発行</button></form>
        <div class="muted">入湯税は課税対象の人数 × 泊数で自動計算されます。</div>
      </section>
      <section><h2>入湯税の帳簿</h2>
        <div class="row"><input id="month" type="month" value="${month}" style="height:44px;border-radius:10px;border:1px solid var(--border);padding:0 10px">
        <button class="b p" data-act="csv">CSVをダウンロード</button></div>
        <div class="muted">日別の客室数・課税人数・免除人数・税額。市への申告と1年間の保存用。</div>
      </section>
    </div>
    <section style="margin-top:16px"><h2>客室 <span class="n">${b.rooms.length}</span></h2>${rooms}</section>
  </div>`;

  document.getElementById('ci').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { room: f.get('room'), taxable: +f.get('taxable'), exempt: +f.get('exempt'), nights: +f.get('nights') };
    try {
      const r = await api('/stays', { method: 'POST', body });
      showQr(body.room, r.url, 'room');
      load();
    } catch (err) {
      fail(err);
    }
  };
}

function showQr(room, url, kind) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  const body =
    kind === 'room'
      ? `<div class="ttl">小夜月</div><div class="room">${esc(room)}号室</div>${svg}
         <div class="langs">スマホで読み取って、お部屋からご注文ください<br>Scan to order to your room<br>掃描即可客房點餐・扫描即可客房点餐<br>스캔하여 객실에서 주문하세요</div>`
      : `<div class="room">${esc(room)}号室 お支払い</div>${svg}<div class="langs">ゲストのスマホで読み取ってお支払いいただけます。<br>ゲストの画面の「お会計」タブにも支払いボタンが出ています。</div>`;
  dlg.innerHTML = `<div class="qr">${body}
    <div class="btns noprint">${kind === 'room' ? '<button class="b" data-act="print">印刷</button>' : ''}<button class="b" data-act="copy" data-url="${esc(url)}">URLをコピー</button><button class="b p" data-act="close">閉じる</button></div></div>`;
  dlg.showModal();
}

function editStay(s) {
  dlg.innerHTML = `<form id="ed" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div style="grid-column:1/-1" class="room">${esc(s.room)}号室</div>
    <label>課税対象<input name="taxable" type="number" min="0" max="30" value="${s.taxable}"></label>
    <label>免除<input name="exempt" type="number" min="0" max="30" value="${s.exempt}"></label>
    <label>泊数<input name="nights" type="number" min="1" max="30" value="${s.nights}"></label>
    <button class="b p" type="submit">保存</button><button class="b" type="button" data-act="close" style="grid-column:1/-1">閉じる</button></form>`;
  dlg.showModal();
  document.getElementById('ed').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api(`/stays/${s.id}`, { method: 'PATCH', body: { taxable: +f.get('taxable'), exempt: +f.get('exempt'), nights: +f.get('nights') } });
      dlg.close();
      load();
    } catch (err) {
      fail(err);
    }
  };
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const { act, id } = el.dataset;
  const stay = board?.rooms.find((s) => s.id === id);
  try {
    switch (act) {
      case 'refresh': return load();
      case 'logout': localStorage.removeItem(PIN_KEY); pin = null; return renderLogin();
      case 'menu': await api('/menu/refresh', { method: 'POST' }); return toast('メニューを読み込み直しました');
      case 'deliver': el.disabled = true; await api(`/orders/${id}/deliver`, { method: 'POST' }); return load();
      case 'cancel': if (!confirm('この注文を取り消しますか？')) return; await api(`/orders/${id}/cancel`, { method: 'POST' }); return load();
      case 'reqdone': el.disabled = true; await api(`/requests/${id}/done`, { method: 'POST' }); return load();
      case 'qr': return showQr(stay.room, stay.url, 'room');
      case 'edit': return editStay(stay);
      case 'checkout': {
        if (!confirm(`${stay.room}号室を精算します。以降、ゲストからの追加注文は止まります。`)) return;
        el.disabled = true;
        const r = await api(`/stays/${id}/checkout`, { method: 'POST' });
        await load();
        if (r.settled) return toast('お支払いはありません。精算済みにしました');
        return showQr(stay.room, r.payUrl, 'pay');
      }
      case 'payqr': return showQr(stay.room, stay.payUrl, 'pay');
      case 'reopen': await api(`/stays/${id}/reopen`, { method: 'POST' }); return load();
      case 'settle': if (!confirm('現金などで受け取り済みとして精算を完了しますか？')) return; await api(`/stays/${id}/settle`, { method: 'POST' }); return load();
      case 'csv': {
        const m = document.getElementById('month').value;
        const res = await api(`/bathtax.csv?month=${m}`, { raw: true });
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `入湯税_${m}.csv`;
        a.click();
        return;
      }
      case 'print': return window.print();
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
