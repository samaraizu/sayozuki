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
// 客室オーダーのスタッフ画面への入口（Cloudflare版だけ。/staff/ は src/order.ts が客室オーダーへ中継する）
const bell = (n) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18"></path><path d="M5 18a7 7 0 0 1 14 0"></path><path d="M12 8V6"></path><path d="M10 6h4"></path></svg>`;
const navs = html.split('</nav>');
if (navs.length !== 3) throw new Error('Index.html の nav が2つ（上・下）ではない');
const withOrder = navs[0] + `  <a href="/staff/">${bell(20)}<span>オーダー</span></a>\n    </nav>` +
  navs[1] + `  <a href="/staff/">\n      ${bell(22)}\n      オーダー\n    </a>\n  </nav>` + navs[2];
const page = withOrder.replace('</head>', '<style>.bottomnav { grid-template-columns: repeat(4, 1fr); }</style>\n</head>');
if (page === withOrder) throw new Error('</head> が無い');
if (/<\?/.test(page)) throw new Error('組み立て漏れのスクリプトレットがある');
out('public/index.html', page);
console.log('built public/index.html, src/lib.gen.js');
