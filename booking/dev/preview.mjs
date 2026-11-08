// GAS なしで画面を確かめるためのプレビュー。
// src/Index.html のテンプレートを組み立て、google.script.run をダミーデータに差し替える。
// 使い方: node dev/preview.mjs [出力先.html]   （出力は .gitignore 済みの dev/preview.html が既定）
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const src = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src('lib.js'), ctx);
const Lib = ctx.Lib;

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const d = (n) => Lib.addDays(today, n);
const rooms = [
  { name: '301', capacity: 4, state: '販売可' },
  { name: '302', capacity: 1, state: '販売可' },
  { name: '月山', capacity: 4, state: '販売可' },
  { name: '蔵王', capacity: 4, state: '販売可' },
  { name: '201', capacity: 5, state: '準備中' },
  { name: '303', capacity: 1, state: '準備中' },
];
// 架空のゲスト
const b = (channel, room, i, o, name, adults, extra = {}) => ({
  channel, room, checkIn: d(i), checkOut: d(o), name, adults: String(adults), status: '確定',
  no: channel === '直販' ? `SZ-TEST-${room}${i}` : `HMTEST${room}${i}`, payment: channel === '直販' ? '現地でSquare' : '媒体で決済済',
  ...extra,
});
const bookings = [
  b('Airbnb', '301', -1, 2, 'Test Guest A', 2),
  b('直販', '301', 3, 5, 'テスト 一郎', 2, { contact: '090-0000-0000', arrival: '16:00', payment: 'HPで決済済', guestPaid: '27000' }),
  b('Airbnb', '302', 1, 4, 'Test Guest B', 1),
  b('楽天', '月山', 2, 3, 'テスト 花子', 2),
  b('Airbnb', '月山', 4, 9, 'Reserved', 0),
  b('直販', '蔵王', 0, 1, 'テスト 次郎', 3, { arrival: '15:00' }),
  b('Airbnb', '蔵王', 2, 5, 'Test Guest C', 2),
  b('直販', '蔵王', 3, 4, 'テスト 三郎', 2),
  b('Airbnb', '月山', -2, 0, 'Test Guest D', 2),
];

// 架空の問い合わせ（HPのご予約フォームから）
const q = (id, i, extra) => ({
  id: `HP-${today.replace(/-/g, '')}-${id}`, receivedAt: `${today.replace(/-/g, '/')} 10:0${i}`, status: '未対応',
  lang: 'ja', email: `test${i}@example.com`, tel: '', nights: 1, guests: 2, room: '', meal: '素泊まり', message: '', ...extra,
});
const inquiries = [
  q('a1b2c3', 1, { name: 'テスト 四郎', checkIn: d(6), nights: 2, room: '蔵王', meal: '1泊2食付き', tel: '090-0000-0001', message: '記念日なので静かな部屋だとうれしいです。' }),
  q('d4e5f6', 2, { name: 'Test Guest E', lang: 'en', checkIn: d(3), room: '201号室', guests: 3, message: 'Is there parking?' }),
  q('0a0b0c', 3, { name: 'テスト 五郎', checkIn: '', guests: 1 }),
];

const mock = `<script>
window.google = { script: { run: (function () {
  var data = ${JSON.stringify({ today, user: 'preview@example.com', rooms, bookings, lastImport: today.replace(/-/g, '/') + ' 11:12', inquiries })};
  var api = {
    getBoard: function () { return Object.assign({ ok: true }, JSON.parse(JSON.stringify(data))); },
    createBooking: function (f) {
      var no = 'SZ-' + data.today.replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 9000) + 1000);
      data.bookings.push({ channel: '直販', no: no, status: '確定', room: f.room, checkIn: f.checkIn, checkOut: f.checkOut,
        adults: String(f.people), name: f.name, contact: f.contact, arrival: f.arrival, payment: Lib.PAYMENTS[f.payment], memo: f.memo });
      if (f.inquiryId) data.inquiries = data.inquiries.filter(function (q) { return q.id !== f.inquiryId; });
      return { ok: true, no: no };
    },
    cancelBooking: function (a) {
      var bk = data.bookings.filter(function (x) { return x.no === a.no; })[0];
      if (!bk) return { ok: false, message: '見つからない' };
      bk.status = 'キャンセル';
      return { ok: true, no: a.no, refund: Number(a.refund || 0) };
    },
    closeInquiry: function (a) {
      data.inquiries = data.inquiries.filter(function (q) { return q.id !== a.id; });
      return { ok: true, id: a.id };
    }
  };
  function runner(ok, ng) {
    return new Proxy({}, { get: function (_, k) {
      if (k === 'withSuccessHandler') return function (fn) { return runner(fn, ng); };
      if (k === 'withFailureHandler') return function (fn) { return runner(ok, fn); };
      return function (arg) { setTimeout(function () { ok(api[k](arg)); }, 300); };
    } });
  }
  return runner(function () {}, function () {});
})() } };
</script>`;

let html = src('Index.html')
  // 本番は doGet の addMetaTag で入る
  .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
  .replace("<?!= include_('Styles') ?>", src('Styles.html'))
  .replace("<?!= include_('App') ?>", mock + src('App.html'))
  .replace('<?!= libSource_() ?>', 'var Lib = (' + ctx.sayozukiLib.toString() + ')();');
if (/<\?/.test(html)) throw new Error('組み立て漏れのスクリプトレットがある');
const out = process.argv[2] || new URL('./preview.html', import.meta.url).pathname;
writeFileSync(out, html);
console.log(out);
