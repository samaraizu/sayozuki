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
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>小夜月 予約</title>\n<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" href="/favicon.png" type="image/png">\n<link rel="manifest" href="/manifest.webmanifest">\n<link rel="apple-touch-icon" href="/icon-180.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="小夜月 予約">\n<meta name="apple-mobile-web-app-status-bar-style" content="black">')
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
// スマホでは「予約登録・問い合わせ・カレンダー」を一番下の切り替えのすぐ上に出す（すりガラスで中身が透ける帯）。
// PCは左のサイドバーの topnav を使うので、こちらは隠す（.dock は display: contents）
const docknav = topnav.replace('<nav class="topnav" aria-label="メイン">', '<nav class="topnav docknav" aria-label="メイン（画面の下）">');
const appnav = `
  <div class="dock">
  ${docknav}
  <nav class="appnav" aria-label="切り替え">
    <a href="/" aria-current="page"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path></svg><span>予約管理</span></a>
    <a href="/staff/"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18"></path><path d="M5 18a7 7 0 0 1 14 0"></path><path d="M12 8V6"></path><path d="M10 6h4"></path></svg><span>リクエスト</span></a>
  </nav>
  </div>`;
const css = `<style>
  /* 一番下の切り替え（予約管理／リクエスト）。客室オーダーのスタッフ画面（order/public/staff/staff.js）と同じ見た目 */
  .bottomnav { display: none !important; }
  /* 真ん中に線。選んでいる方は背景をオフホワイト、もう片方は黒系のまま */
  .appnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: #131720; }
  /* アイコンと文字を横並びにして高さを詰める。ホームバーの分の余白は safe-area から 14px 引いた分だけ（最低 10px） */
  .appnav a { min-height: 0; padding: 10px 0 max(10px, calc(env(safe-area-inset-bottom) - 14px)); display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; color: var(--muted); text-decoration: none; font-size: 13px; }
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
  /* スマホ：一番下の切り替えを position: fixed で貼り付けると、iPhoneのホーム画面アプリでは
     スクロール中に画面の外へずれて見切れる。ページ全体ではなく .shell（画面の高さぴったり）をスクロールさせ、
     切り替えはその中で sticky にして一番下に留める。上のメニューは前と同じく中身と一緒に流れる */
  @media (max-width: 899px) {
    html, body { height: 100%; overflow: hidden; }
    .shell { position: relative; height: 100vh; height: 100dvh; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
    .top { flex: none; }
    .view { padding-bottom: 24px; }
    /* 下に固定する帯：予約登録・問い合わせ・カレンダー（すりガラス）＋切り替え */
    .top .topnav { display: none; }
    .dock { position: sticky; bottom: 0; margin-top: auto; z-index: 6; flex: none; }
    .dock .appnav { position: static; }
    .docknav { padding: 10px 16px; background: rgba(15, 18, 24, 0.55); -webkit-backdrop-filter: blur(14px) saturate(140%); backdrop-filter: blur(14px) saturate(140%); box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.3); }
    .docknav a { background: rgba(32, 38, 50, 0.72) !important; }
    .docknav a[aria-current="page"] { background: rgba(28, 46, 66, 0.85) !important; }
  }
  @media (min-width: 900px) {
    .dock { display: contents; }
    .docknav { display: none !important; }
  }
  @media (min-width: 900px) {
    .top { height: calc(100vh - 42px); } /* 一番下の切り替えの高さ（42px）を除く */
    .view { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
    .topnav .nav-ico svg { width: 20px; height: 20px; }
  }
  /* ---- フラット：枠線をなくし、面の浮き沈みはドロップシャドウだけで見せる（2026-11-22） ---- */
  :root {
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25);
    --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.4), 0 8px 20px rgba(0, 0, 0, 0.35);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5), 0 24px 48px rgba(0, 0, 0, 0.45);
    --raise: #1B202A;
  }
  .topnav a { border: 0 !important; }
  @media (max-width: 899px) {
    .topnav a { background: var(--raise); box-shadow: var(--shadow-sm); }
    .topnav a[aria-current="page"] { background: #1C2A3A; }
  }
  @media (min-width: 900px) {
    .top { border-right: 0; box-shadow: 4px 0 20px rgba(0, 0, 0, 0.35); z-index: 3; }
    .month { border-left: 0; }
  }
  .appnav { border-top: 0; box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.4); }
  .appnav a + a { border-left: 0; }
  .pill { border: 0; background: var(--raise); box-shadow: var(--shadow-sm); }
  .alert { border: 0; box-shadow: var(--shadow-md); }
  .inbox-alert { border: 0; }
  .need { border: 0; background: rgba(255, 107, 107, 0.16); }
  .sw.prep { border: 0; }
  .todaycards { padding: 12px 16px 6px; }
  .card { border: 0; background: var(--raise); box-shadow: var(--shadow-md); }
  .legend { padding: 12px 16px 4px; }
  /* 予約のブロック：枠なしの面＋影。媒体の色は下の帯（内側の影）で出す */
  .bar { --ch: var(--line-2); border: 0; background: #222834; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: inset 0 -3px 0 var(--ch), var(--shadow-sm); }
  .bar.airbnb { --ch: var(--airbnb); }
  .bar.agoda { --ch: var(--agoda); }
  .bar.expedia { --ch: var(--expedia); }
  .bar.rakuten { --ch: var(--rakuten-line); }
  .bar.direct { --ch: var(--direct); }
  .bar.need-input { outline: 0; background: #3A1F25; }
  .empty { border: 0; background: var(--panel-2); }
  .qcard, .step, .savebox { border: 0; background: var(--raise); box-shadow: var(--shadow-md); }
  .ghost { border: 0; background: var(--raise); box-shadow: var(--shadow-sm); }
  .ghost.danger { background: #2A171B; }
  .from-inq { border: 0; box-shadow: var(--shadow-sm); }
  .cancelbox { border: 0; box-shadow: var(--shadow-sm); }
  .mealbox .mpreview, .policy { border: 0; background: var(--panel-2); }
  .detail { border: 0; box-shadow: var(--shadow-lg); }
  .input { border: 0; background: #0B0E13; box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6); }
  .stepper button { border: 0; background: var(--raise); box-shadow: var(--shadow-sm); }
  .rcard { border: 0 !important; background: var(--raise); box-shadow: var(--shadow-sm); }
  .rcard[aria-pressed="true"] { background: #1C3550; box-shadow: var(--shadow-md); }
  .rcard:disabled { background: var(--panel-2); box-shadow: none; opacity: 0.7; }
  .seg { border: 0; background: var(--raise); box-shadow: var(--shadow-sm); }
  .seg[aria-pressed="true"] { background: var(--accent); }
  .save { box-shadow: var(--shadow-md); }
  .toast { border: 0; box-shadow: var(--shadow-lg); }
  /* 今日のチェックインは青系の面（チェックアウトはいつもの面のまま） */
  .todaycards .card:first-child { background: #17324D; }
  .todaycards .card:first-child .k, .todaycards .card:first-child .m { color: var(--accent-soft); }
  /* 月のカレンダーを1枚の面に載せる（外枠＋ドロップシャドウ）。
     左右の余白は「面の外 8px＋面の内 8px」で前の 16px と同じにし、マスの大きさは変えない */
  .month { margin: 0 8px; padding: 4px 0 10px; border-radius: 18px; background: var(--raise); box-shadow: var(--shadow-md); }
  .month .cal-head { padding-left: 8px; padding-right: 8px; }
  .mgrid { padding: 0 8px; }
  .mcell:hover { background: #222834; }
  @media (min-width: 1200px) { .month { margin: 0 16px 0 8px; } }
  /* 一番下の月の売上 */
  .sales { margin: 20px 8px 8px; padding: 4px 0 14px; border-radius: 18px; background: var(--raise); box-shadow: var(--shadow-md); }
  .sales .cal-head { padding-left: 8px; padding-right: 8px; }
  .sales-title { font-size: 16px !important; color: var(--text) !important; }
  .skpi { padding: 2px 16px 8px; display: flex; gap: 28px; }
  .skpi div { display: flex; flex-direction: column; gap: 2px; }
  .skpi .k { font-size: 11px; color: var(--muted); }
  .skpi .v { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  /* 縦棒グラフ：1系列なので凡例なし（見出しが名前）。選んだ月だけ濃い青と値ラベル、ほかは薄い青 */
  .chart { padding: 12px 16px 0; }
  .chart-h { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: var(--muted); padding-bottom: 6px; }
  .chart-h .cmax { font-size: 10px; color: var(--faint); }
  .bars { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0; height: 132px; border-bottom: 1px solid var(--line-2); }
  .bcol { all: unset; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; min-width: 0; height: 100%; cursor: pointer; padding-top: 2px; }
  .bcol .bval { height: 14px; font-size: 10px; font-weight: 700; color: var(--text); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .bcol .btrack { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
  .bcol .bfill { display: block; width: min(70%, 22px); border-radius: 4px 4px 0 0; background: rgba(124, 196, 255, 0.42); }
  .bcol.future .bfill { background: rgba(124, 196, 255, 0.22); }
  .bcol.on .bfill { background: var(--accent); }
  .bcol:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
  .bx { display: none; }
  .chart + .chart .bars { height: 96px; }
  /* 月の目盛りは下のグラフの下にだけ出す */
  .chart:last-of-type .bx { display: block; }
  .chart:last-of-type .bars { border-bottom: 0; }
  .chart:last-of-type .btrack { border-bottom: 1px solid var(--line-2); }
  .bx { padding-top: 4px; font-size: 10px; color: var(--faint); white-space: nowrap; }
  .bcol.now .bx { color: var(--accent); font-weight: 700; }
  .bcol.on .bx { color: var(--text); font-weight: 700; }
  .snote { margin: 12px 16px 0; font-size: 11px; color: var(--faint); line-height: 1.5; }
  @media (min-width: 900px) { .sales { margin: 24px 16px 8px; } .bars { height: 160px; } .chart + .chart .bars { height: 110px; } }
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
