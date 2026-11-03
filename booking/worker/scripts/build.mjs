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
    }
  };
  function runner(ok, ng) {
    return new Proxy({}, { get: function (_, k) {
      if (k === 'withSuccessHandler') return function (fn) { return runner(fn, ng); };
      if (k === 'withFailureHandler') return function (fn) { return runner(ok, fn); };
      return function (arg) {
        routes[k](arg)
          .then(function (r) {
            // Access のログインが切れていると HTML のログイン画面が返る
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
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>小夜月 予約</title>')
  .replace("<?!= include_('Styles') ?>", () => src('Styles.html'))
  .replace("<?!= include_('App') ?>", () => shim + src('App.html'))
  .replace('<?!= libSource_() ?>', () => lib.replace(/<\/script/gi, '<\\/script'));
if (/<\?/.test(html)) throw new Error('組み立て漏れのスクリプトレットがある');
out('public/index.html', html);
console.log('built public/index.html, src/lib.gen.js');
