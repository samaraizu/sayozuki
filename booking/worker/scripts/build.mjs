// 画面とサーバーの共通計算を ../src（GAS版）から組み立てる。
//   public/index.html … GAS版の Index.html に Styles・App・lib を埋め込み、
//                       google.script.run を /api への fetch に差し替えたもの
//   src/lib.gen.js    … lib.js を ES モジュールにしたもの（Worker が import する）
// GAS版を止めるまでは、画面とロジックの正本は ../src に置いたまま両方で使う。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = (name) => readFileSync(new URL(`../../src/${name}`, import.meta.url), 'utf8');
const out = (path, text) => {
  const url = new URL(`../${path}`, import.meta.url);
  mkdirSync(new URL('.', url), { recursive: true });
  writeFileSync(url, text);
};

const lib = src('lib.js');
if (!/var Lib = sayozukiLib\(\);\s*$/.test(lib)) throw new Error('lib.js の末尾が想定と違う');
out('src/lib.gen.js', '// npm run build が ../src/lib.js から作る。直接直さない\n' + lib + '\nexport { Lib };\n');

// google.script.run と同じ形で呼べるようにする（App.html は手を入れずに使う）
const shim = `<script>
window.google = { script: { run: (function () {
  var routes = {
    getBoard: function () { return fetch('/api/board', { credentials: 'same-origin' }); },
    createBooking: function (form) {
      return fetch('/api/bookings', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    },
    cancelBooking: function (arg) {
      return fetch('/api/bookings/cancel', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(arg) });
    },
    setMeals: function (arg) {
      return fetch('/api/bookings/meals', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(arg) });
    },
    closeInquiry: function (arg) {
      return fetch('/api/inquiries/close', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(arg) });
    }
  };
  function runner(ok, ng) {
    return new Proxy({}, { get: function (_, k) {
      if (k === 'withSuccessHandler') return function (fn) { return runner(fn, ng); };
      if (k === 'withFailureHandler') return function (fn) { return runner(ok, fn); };
      return function (arg) {
        routes[k](arg)
          .then(function (r) {
            // ログインしていない・切れた・許可リストから外れた → ログイン画面へ
            if (r.status === 401) { location.replace('/login'); return null; }
            if (!(r.headers.get('content-type') || '').includes('application/json')) { location.reload(); return null; }
            return r.json();
          })
          .then(function (j) { if (j) ok(j); }, function (e) { ng(e); });
      };
    } });
  }
  return runner(function () {}, function () {});
})() } };
</script>`;

const html = src('Index.html')
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>小夜月 予約</title>\n<link rel="manifest" href="/manifest.webmanifest">\n<link rel="apple-touch-icon" href="/icon-180.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="小夜月 予約">\n<meta name="apple-mobile-web-app-status-bar-style" content="black">')
  .replace("<?!= include_('Styles') ?>", () => src('Styles.html'))
  .replace("<?!= include_('App') ?>", () => shim + src('App.html') + '\n<script src="/push.js" defer></script>')
  .replace('<?!= libSource_() ?>', () => lib.replace(/<\/script/gi, '<\\/script'));
// 一番下の切り替え「予約管理／リクエスト」（Cloudflare版だけ。GAS版の Index.html は触らない）
// リクエスト＝客室オーダーのスタッフ画面（/staff/。src/order.ts が客室オーダーへ中継し、向こうにも同じ切り替えが出る）
// カレンダー・問い合わせ・手動入力は、スマホでは画面の上（ロゴの下）のタブ、PCでは左のサイドバー
const bottom = html.match(/\n\s*<nav class="bottomnav"[\s\S]*?<\/nav>/);
if (!bottom) throw new Error('Index.html の下のナビが見つからない');
const appnav = `
  <nav class="appnav" aria-label="切り替え">
    <a href="/" aria-current="page"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path></svg><span>予約管理</span></a>
    <a href="/staff/"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18"></path><path d="M5 18a7 7 0 0 1 14 0"></path><path d="M12 8V6"></path><path d="M10 6h4"></path></svg><span>リクエスト</span></a>
  </nav>`;
const css = `<style>
  /* 一番下の切り替え（予約管理／リクエスト）。客室オーダーのスタッフ画面（order/public/staff/staff.js）と同じ見た目 */
  .bottomnav { display: none !important; }
  .appnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: #131720; padding: 6px 4px calc(8px + env(safe-area-inset-bottom)); }
  .appnav a { min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--muted); text-decoration: none; font-size: 12px; }
  .appnav a[aria-current="page"] { color: var(--accent); font-weight: 700; }
  /* スマホ：カレンダー・問い合わせ・手動入力はロゴの下に横並び */
  @media (max-width: 899px) {
    .top { padding-bottom: 8px; }
    .topnav { display: flex; width: 100%; gap: 6px; }
    .topnav a { flex: 1; justify-content: center; height: 40px; padding: 0 8px; gap: 0; border: 1px solid var(--line); font-size: 13px; white-space: nowrap; }
    .topnav a svg { display: none; }
    .topnav a[aria-current="page"] { border-color: #2E3A4D; }
  }
  @media (min-width: 900px) {
    .top { height: calc(100vh - 66px); }
    .view { padding-bottom: 96px; }
  }
</style>`;
const page = html.replace(bottom[0], appnav).replace('</head>', css + '\n</head>');
if (!page.includes('class="appnav"') || !page.includes('.appnav {')) throw new Error('切り替えを入れられなかった');
if (/<\?/.test(page)) throw new Error('組み立て漏れのスクリプトレットがある');
out('public/index.html', page);
console.log('built public/index.html, src/lib.gen.js');
