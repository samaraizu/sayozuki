// 「通知をオンにする」ボタン。画面の上（ロゴの右）に出す。iPhoneはホーム画面に追加したアプリからだけ使える
(function () {
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var KEY = 'sz_push';
  var on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pill';
  btn.style.cssText = 'margin-left:auto;font-size:13px;height:34px;padding:0 12px;';
  function label() {
    btn.textContent = on ? '通知：オン' : '通知をオンにする';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.style.color = on ? 'var(--accent)' : '';
  }
  label();
  var top = document.querySelector('header.top');
  if (top) top.appendChild(btn);

  function say(msg) {
    var t = document.getElementById('toast');
    if (!t) return alert(msg);
    t.textContent = msg; t.className = 'toast'; t.hidden = false;
    clearTimeout(say.t); say.t = setTimeout(function () { t.hidden = true; }, 6000);
  }
  function post(path, body) {
    return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); });
  }
  function bytes(s) {
    var b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    var u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }

  function enable() {
    if (!supported || (ios && !standalone)) {
      alert(ios
        ? 'iPhoneで通知を受け取るには：\n1. Safariでこの画面を開き、下の共有ボタン（□に↑）を押す\n2.「ホーム画面に追加」を押す\n3. ホーム画面にできた「小夜月 予約」から開き直して、もう一度「通知をオンにする」を押す\n（iOS 16.4以降）'
        : 'このブラウザは通知に対応していません。Chromeで開き直してください。');
      return;
    }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { say('通知が許可されなかった。スマホの設定でこのアプリの通知を許可して'); return; }
      return navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function () { return navigator.serviceWorker.ready; })
        .then(function (reg) {
          return fetch('/api/push/key', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (k) {
            return reg.pushManager.getSubscription().then(function (sub) {
              return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(k.key) });
            });
          });
        })
        .then(function (sub) { return post('/api/push/subscribe', { endpoint: sub.endpoint }); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.message) || '登録できなかった');
          on = true;
          try { localStorage.setItem(KEY, '1'); } catch (e) {}
          label();
          return post('/api/push/test').then(function () { say('通知をオンにした。テスト通知を送った'); });
        });
    }).catch(function (e) { say('通知をオンにできなかった（' + (e && e.message ? e.message : e) + '）'); });
  }

  function disable() {
    if (!confirm('この端末への通知をオフにする？')) return;
    navigator.serviceWorker.getRegistration('/').then(function (reg) {
      return reg && reg.pushManager.getSubscription();
    }).then(function (sub) {
      if (!sub) return;
      return post('/api/push/unsubscribe', { endpoint: sub.endpoint }).then(function () { return sub.unsubscribe(); });
    }).catch(function () {}).then(function () {
      on = false;
      try { localStorage.removeItem(KEY); } catch (e) {}
      label();
      say('通知をオフにした');
    });
  }

  btn.addEventListener('click', function () { if (on) disable(); else enable(); });

  // 通知をオンにした端末は、開くたびにサービスワーカーを最新にしておく
  if (on && supported) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
})();
