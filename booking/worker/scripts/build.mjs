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
// 予約登録・問い合わせ・カレンダーは、スマホでは画面の上（ロゴの下）、PCでは左のサイドバー
// 上のナビ（Cloudflare版だけ）：並びは「＋ 予約登録」「問い合わせ」「カレンダー」。
// スマホでは問い合わせ・カレンダーを文字なしの大きめのアイコンにする（PCの左サイドバーは文字も出す）
const top = html.match(/<nav class="topnav"[\s\S]*?<\/nav>/);
if (!top) throw new Error('Index.html の上のナビが見つからない');
const svg = (n, d) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const topnav = `<nav class="topnav" aria-label="メイン">
      <a href="#new" data-view="new" class="nav-new">${svg(20, '<path d="M12 5v14"></path><path d="M5 12h14"></path>')}<span>予約登録</span></a>
      <a href="#inbox" data-view="inbox" class="nav-ico" aria-label="問い合わせ" title="問い合わせ">${svg(26, '<path d="M4 13l2.5-7h11L20 13"></path><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"></path><path d="M4 13h4.5l1 2h5l1-2H20"></path>')}<span class="label">問い合わせ</span><span class="badge" data-inbox-count hidden></span></a>
      <a href="#cal" data-view="cal" class="nav-ico" aria-label="カレンダー" title="カレンダー">${svg(26, '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path>')}<span class="label">カレンダー</span></a>
    </nav>`;
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
  /* 真ん中に線。選んでいる方は背景をオフホワイト、もう片方は黒系のまま */
  .appnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: #131720; }
  .appnav a { min-height: 60px; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--muted); text-decoration: none; font-size: 12px; }
  .appnav a + a { border-left: 1px solid var(--line-2); }
  .view { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
  .appnav a[aria-current="page"] { background: #F3F0E8; color: #15181F; font-weight: 700; }
  /* スマホ：ロゴの下に「＋ 予約登録」と、問い合わせ・カレンダーの大きめのアイコンを横並び */
  @media (max-width: 899px) {
    .top { padding-bottom: 8px; }
    .topnav { display: flex; width: 100%; gap: 8px; }
    .topnav a { position: relative; justify-content: center; height: 52px; border: 1px solid var(--line); white-space: nowrap; }
    .topnav .nav-new { flex: 1; gap: 6px; padding: 0 12px; font-size: 15px; font-weight: 700; color: var(--accent); border-color: #2E3A4D; }
    .topnav .nav-ico { flex: none; width: 60px; padding: 0; color: var(--muted); }
    .topnav .nav-ico .label { display: none; }
    .topnav .nav-ico .badge { position: absolute; top: 4px; right: 6px; margin: 0; }
    .topnav a[aria-current="page"] { border-color: #2E3A4D; color: var(--accent); }
  }
  /* 月のカレンダー：四角い枠をなくし、数字を大きく。数字の下に「予〜」「空〜」を小さく（卓上カレンダーのような見た目） */
  .mgrid { gap: 2px 0; }
  .mwd { font-size: 11px; letter-spacing: 0.08em; padding: 4px 0 8px; }
  .mcell { aspect-ratio: auto; min-height: 60px; padding: 6px 0 4px; border: 0; border-radius: 14px; background: transparent; justify-content: flex-start; align-items: center; gap: 3px; text-align: center; }
  .mcell:hover { background: #171B23; }
  .mn { font-size: 19px; font-weight: 500; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
  .mcount { align-items: center; gap: 1px; font-size: 10px; }
  .mfree { font-size: 10px; color: var(--faint); }
  .mcell.today { border: 0; }
  .mcell.today .mn { color: var(--accent); font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
  .mcell.sel { background: transparent; border: 0; }
  .mcell.sel .mn { color: var(--accent-soft); }
  .mcell.clash { border: 0; box-shadow: none; }
  .mcell.clash .mn { color: var(--red); font-weight: 700; }
  .mcell.clash .mfree { color: var(--red-soft); }
  @media (min-width: 1200px) { .mn { font-size: 18px; } }
  @media (max-width: 899px) { .top { padding-top: calc(10px + env(safe-area-inset-top)); } }
  @media (min-width: 900px) {
    .top { height: calc(100vh - 66px); }
    .view { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
    .topnav .nav-ico svg { width: 20px; height: 20px; }
  }
</style>`;
// ヘッダーのロゴと「小夜月 予約」の文字は出さない（Cloudflare版だけ。ホーム画面のアプリ名で分かるため）
const brand = html.match(/\n\s*<div class="brand">[\s\S]*?<\/div>/);
if (!brand) throw new Error('Index.html のロゴが見つからない');
const page = html.replace(brand[0], '').replace(top[0], topnav).replace(bottom[0], appnav).replace('</head>', css + '\n</head>');
if (page.includes('class="brand"')) throw new Error('ロゴを消せなかった');
if (!page.includes('class="appnav"') || !page.includes('.appnav {')) throw new Error('切り替えを入れられなかった');
if (/<\?/.test(page)) throw new Error('組み立て漏れのスクリプトレットがある');
out('public/index.html', page);
console.log('built public/index.html, src/lib.gen.js');
