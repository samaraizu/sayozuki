// 取り込みGASの関数を Node で動かすテスト（メール本文は実物と同じ構造で、名前と番号だけ差し替え）
// 取り込みGAS（booking-system/Code.js）を Node の vm で読み込み、GASの部品は偽物で動かす
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const CODE = new URL('../booking-system/Code.js', import.meta.url);

test('取り込みGAS：メールの読み取り・iCal・台帳ルール', () => {
const src = fs.readFileSync(CODE, 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;this.__x = { parseConfirmation_, parseCancellation_, parseChange_, parseIcal_, classify_, applyConfirm_, applyCancel_, applyChange_, applyIcal_, applyRules_, makeCtx_, newRow_, tagsOf_, TAG, CONFIG };', ctx);
const X = ctx.__x;

const WJ = '⁠';
const pad = ' '.repeat(180);

function confirmBody({ first, full, code, listing, title, dates, times, guests, perNight, nights, total, payout }) {
  return `%opentrack%
https://www.airbnb.jp/?src_section=BOOKING_EMAIL_HEADER&c=.pi80.pkYm9va2luZy9ob3N0L1Jlc2VydmF0aW9uSG9zdENvbmZpcm1hdGlvblRlbXBsYXRl&euid=00000000

新規しい予約が確定しました！${first.toUpperCase()}${WJ}さ${WJ}ん${WJ}が10月31日に到${WJ}着し${WJ}ま${WJ}す${WJ}。

${first}さんに歓迎のメッセージを送り、チェックインの詳細を確認しておきましょう。

https://www.airbnb.jp/hosting/reservations/details/${code}?isPending=true&src_section=HOST_PENDING_BOOKING_EMAIL_GUEST_AVATAR&c=.pi80.pkYm9va2luZy9ob3N0L1Jlc2VydmF0aW9uSG9zdENvbmZpcm1hdGlvblRlbXBsYXRl&euid=00000000 ${full}

${pad}[https://www.airbnb.jp/hosting/reservations/details/${code}?isPending=true&c=.pi80.pkYm9va2luZy9ob3N0L1Jlc2VydmF0aW9uSG9zdENvbmZpcm1hdGlvblRlbXBsYXRl&euid=00000000]

${pad}ID認証済み

${first}さんにメッセージを送る${first}さんにメッセージを送る
[https://www.airbnb.jp/hosting/thread/1000000000?thread_type=home_booking]

https://www.airbnb.jp/rooms/${listing}?src_section=BOOKING_EMAIL_HERO_IMAGE&c=.pi80.pkYm9va2luZy9ob3N0L1Jlc2VydmF0aW9uSG9zdENvbmZpcm1hdGlvblRlbXBsYXRl&euid=00000000

${title}

ゲストルーム

[https://www.airbnb.jp/rooms/${listing}?src_section=HOST_PENDING_BOOKING_EMAIL_LISTING_NAME]

チェックイン チェックアウト

${dates}

${times}

ゲスト人数

${guests}

宿泊予定のゲストについて

今後、ゲストがお子様連れまたは乳幼児連れの場合、その旨がホストに通知されます。必要に応じてハウスルールを更新
[https://www.airbnb.com/hosting/listings/${listing}/details/safety-info]し、お子様連れに適しているかどうかを事前に伝えましょう。

確認コード
${code}

ゲストの支払い金額

¥${perNight} x ${nights}泊 ¥${total}

ゲストサービス料 ¥0

合計（JPY） ¥${total}

ホストの受取金

${nights}泊の宿泊料金 ¥${total}

ホストサービス料（15.5%） -¥5,400

ホスティング収入 ¥${payout}

ホスティング収入を確認ホスティング収入を確認
[https://www.airbnb.jp/users/transaction_history]

キャンセルについて
ゲスト向けに設定されたキャンセルポリシーは「柔軟
[https://www.airbnb.com/help/article/149]」です。

カスタマーサポート
世界中どこからでも24${WJ}時${WJ}間${WJ}365${WJ}日${WJ}対${WJ}応のサ${WJ}ポ${WJ}ー${WJ}トチ${WJ}ー${WJ}ムま${WJ}でお${WJ}問${WJ}い${WJ}合${WJ}わ${WJ}せい${WJ}た${WJ}だ${WJ}け${WJ}ま${WJ}す${WJ}。
`;
}

const L_MAIN = '1000000000000000001', L_TWO = '1000000000000000002', L_FOUR = '1000000000000000003';

// ---------- 1. 予約確定：年なし・外国人名
let p = X.parseConfirmation_('予約確定 - TestPersonAnnaさんが10月31日に到着します', confirmBody({
  first: 'Anna', full: 'Anna Test Person', code: 'HMAAAA1111', listing: L_TWO,
  title: 'ふたりの和室｜夜の静けさを買う温泉宿。灯りを落とした夜と塩化物泉、',
  dates: '10月31日(土) 11月3日(火)', times: '15:00 10:00', guests: '大人2人',
  perNight: '11,613', nights: 3, total: '34,840', payout: '29,440',
}).replace(/\n/g, '\r\n'), '2026-10-28');
assert.strictEqual(p.ok, true, JSON.stringify(p));
assert.strictEqual(p.code, 'HMAAAA1111');
assert.strictEqual(p.checkIn, '2026-10-31');
assert.strictEqual(p.checkOut, '2026-11-03');
assert.strictEqual(p.checkInTime, '15:00');
assert.strictEqual(p.adults, 2);
assert.strictEqual(p.name, 'Anna Test Person');
assert.strictEqual(p.listingId, L_TWO);
assert.strictEqual(p.listingTitle, 'ふたりの和室｜夜の静けさを買う温泉宿。灯りを落とした夜と塩化物泉');
assert.strictEqual(p.guestTotal, 34840);
assert.strictEqual(p.payout, 29440);
assert.strictEqual(p.warn, '');
console.log('OK 確定（年なし・外国人名）', p.checkIn, p.checkOut, p.name, p.adults, p.guestTotal, p.payout);

// ---------- 2. 予約確定：年またぎ（年あり）
p = X.parseConfirmation_('予約確定 - PersonTestさんが12月31日に到着します', confirmBody({
  first: 'Test', full: 'Test Person', code: 'HMBBBB2222', listing: L_MAIN,
  title: '夜の静けさを買う温泉宿。灯りを落とした和室と塩化物泉。かみのやま温泉駅すぐ、蔵王観光の拠点にも！',
  dates: '2026年12月31日(木) 2027年1月3日(日)', times: '15:00 10:00', guests: '大人1人',
  perNight: '6,221', nights: 3, total: '18,662', payout: '15,769',
}), '2026-10-07');
assert.strictEqual(p.checkIn, '2026-12-31');
assert.strictEqual(p.checkOut, '2027-01-03');
console.log('OK 確定（年またぎ）', p.checkIn, p.checkOut);

// ---------- 3. 翌年の予約（年あり）
p = X.parseConfirmation_('予約確定 - Xさんが2月27日に到着します', confirmBody({
  first: 'X', full: 'X Y', code: 'HMCCCC3333', listing: L_MAIN, title: 't',
  dates: '2027年2月27日(土) 2027年2月28日(日)', times: '15:00 11:00', guests: '大人1人',
  perNight: '5,132', nights: 1, total: '5,132', payout: '4,337',
}), '2026-10-07');
assert.strictEqual(p.checkIn, '2027-02-27');
assert.strictEqual(p.checkOut, '2027-02-28');
console.log('OK 確定（翌年）', p.checkIn, p.checkOut);

// ---------- 4. 年なしで年をまたぐ（念のため）
p = X.parseConfirmation_('予約確定 - Zさんが12月30日に到着します', confirmBody({
  first: 'Z', full: 'Z Z', code: 'HMDDDD4444', listing: L_FOUR, title: 't',
  dates: '12月30日(水) 1月2日(土)', times: '15:00 10:00', guests: '大人2人、子ども1人',
  perNight: '1', nights: 3, total: '3', payout: '2',
}), '2026-12-01');
assert.strictEqual(p.checkIn, '2026-12-30');
assert.strictEqual(p.checkOut, '2027-01-02');
assert.strictEqual(p.children, 1);
assert.strictEqual(p.warn, '');
console.log('OK 確定（年なしで年またぎ・子ども）', p.checkIn, p.checkOut, p.adults, p.children);

// ---------- 5. 日本人名（名 姓の順）
p = X.parseConfirmation_('予約確定 - 山田太郎さんが10月31日に到着します', confirmBody({
  first: '太郎', full: '太郎 山田', code: 'HMEEEE5555', listing: L_FOUR,
  title: '4名の和室｜夜の静けさを買う温泉宿。塩化物泉、かみのやま温泉駅すぐ、蔵王へ車40分',
  dates: '10月31日(土) 11月1日(日)', times: '15:00 11:00', guests: '大人4人',
  perNight: '23,008', nights: 1, total: '23,008', payout: '19,442',
}), '2026-10-20');
assert.strictEqual(p.name, '太郎 山田');
assert.strictEqual(p.adults, 4);
console.log('OK 確定（日本人名）', p.name);

// ---------- 6. 読めない人数
p = X.parseConfirmation_('予約確定 - Qさんが10月31日に到着します', confirmBody({
  first: 'Q', full: 'Q Q', code: 'HMFFFF6666', listing: L_FOUR, title: 't',
  dates: '10月31日(土) 11月1日(日)', times: '15:00 11:00', guests: '大人2人、ペット1匹',
  perNight: '1', nights: 1, total: '1', payout: '1',
}), '2026-10-20');
assert.ok(p.ok && p.warn.indexOf('読めない部分') >= 0, p.warn);
console.log('OK 人数に読めない部分 →', p.warn);

// ---------- 7. 壊れたメール
p = X.parseConfirmation_('予約確定 - Qさん', 'なにもない本文', '2026-10-20');
assert.strictEqual(p.ok, false);
console.log('OK 壊れたメールは失敗扱い →', p.error);

// ---------- 8. キャンセル
const cancelBody = `こちらの日付で再度予約を受けられるようになりました
 ͏  ͏  ͏  ͏ ­ ­ ­ ­
%opentrack%
https://www.airbnb.jp/?c=.pi80.pkQ0FOQ0VMTEFUSU9OU19SRVNFUlZBVElPTl9DQU5DRUxFRF9CWV9HVUVTVF9UT19IT1NU

ご予約がキ${WJ}ャ${WJ}ン${WJ}セ${WJ}ルさ${WJ}れ${WJ}ま${WJ}し${WJ}た

https://www.airbnb.jp/hosting/reservations/details/HMGGGG7777?email_cta=link_canceled_reservation_by_guest&c=.pi80 夜の静けさを買う温泉宿。灯りを落とした和室と塩化物泉。蔵王観光の拠点にも！

${pad}リスティング#${L_MAIN}

${pad}11月2日～9日, 1人

${pad}[https://www.airbnb.jp/hosting/reservations/details/HMGGGG7777?email_cta=link_canceled_reservation_by_guest]

大変恐れ入りますが、ゲストのCarolさんにより、やむを得ず11月2日～9日のご予約（HMGGGG7777）がキャンセルされました。`;
p = X.parseCancellation_('キャンセルのお知らせ：11月2日～9日のご予約（HMGGGG7777）', cancelBody, '2026-10-19');
assert.strictEqual(p.ok, true);
assert.strictEqual(p.code, 'HMGGGG7777');
assert.strictEqual(p.checkIn, '2026-11-02');
assert.strictEqual(p.checkOut, '2026-11-09');
assert.strictEqual(p.guests, 1);
assert.strictEqual(p.listingId, L_MAIN);
assert.strictEqual(p.canceledBy, 'ゲスト');
console.log('OK キャンセル', p.code, p.checkIn, p.checkOut, p.guests, p.listingTitle);

// ---------- 9. 予約変更
const changeBody = `%opentrack%
https://www.airbnb.jp/?c=.pi80.pkQUxURVJBVElPTl9BQ0NFUFRFRA%3D%3D

BETTYさんとのご予約が変更されました

https://www.airbnb.jp/hosting/reservations/details/HMHHHH8888?c=.pi80.pkQUxURVJBVElPTl9BQ0NFUFRFRA%3D%3D Betty

${pad}どこか, どこかの国

予約内容は変更済みです。`;
p = X.parseChange_('ご予約が変更されました', changeBody);
assert.strictEqual(p.ok, true);
assert.strictEqual(p.code, 'HMHHHH8888');
assert.strictEqual(p.name, 'BETTY');
console.log('OK 変更', p.code, p.name);

// ---------- 10. 件名の振り分け
assert.strictEqual(X.classify_('予約確定 - Aさんが10月31日に到着します'), 'confirm');
assert.strictEqual(X.classify_('キャンセルのお知らせ：11月2日～9日のご予約（HMZZZZ9999）'), 'cancel');
assert.strictEqual(X.classify_('ご予約が変更されました'), 'change');
assert.strictEqual(X.classify_('Bettyさんが予約変更をご希望です'), null);
assert.strictEqual(X.classify_('保留中：「4名の和室」の予約リクエスト（2026年12月28日～29日）'), null);
assert.strictEqual(X.classify_('予約リマインダー：花子さんがまもなく到着します！'), null);
console.log('OK 件名の振り分け（リクエスト・リマインダー・変更希望は無視）');

// ---------- 11. iCal（折り返し行あり）
const ics = [
  'BEGIN:VCALENDAR', 'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN', 'VERSION:2.0',
  'BEGIN:VEVENT', 'DTEND;VALUE=DATE:20261103', 'DTSTART;VALUE=DATE:20261031', 'UID:1@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMAAAA', ' 1111\\nPhone Number (Last 4 Digits): 1234',
  'SUMMARY:Reserved', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTEND;VALUE=DATE:20261210', 'DTSTART;VALUE=DATE:20261205', 'UID:2@airbnb.com',
  'SUMMARY:Airbnb (Not available)', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');
const evs = X.parseIcal_(ics);
assert.strictEqual(evs.length, 2);
assert.strictEqual(evs[0].code, 'HMAAAA1111');
assert.strictEqual(evs[0].start, '2026-10-31');
assert.strictEqual(evs[0].end, '2026-11-03');
assert.strictEqual(evs[1].code, '');
console.log('OK iCal（折り返し・ブロック日の区別）');

// ---------- 12. 台帳ルール（シミュレーション）
function table(rows) { return { rows: rows.map(v => ({ _row: 2, v, dirty: {}, isNew: false })) }; }
const res = table([
  { '媒体': '直販', '予約番号': '', 'ステータス': '確定', '部屋': '蔵王', 'チェックイン': '2026-11-01', 'チェックアウト': '2026-11-02', '大人': 2, '代表者名': '田中' },
]);
const airbnb = table([{ 'リスティングID': L_FOUR, '部屋': '蔵王' }]);
const rooms = table([
  { '部屋': '301', '定員': 4, '状態': '販売可' }, { '部屋': '302', '定員': 1, '状態': '販売可' },
  { '部屋': '蔵王', '定員': 4, '状態': '販売可' }, { '部屋': '201', '定員': 5, '状態': '準備中' },
]);
const C = X.makeCtx_(res, airbnb, rooms);
const notes = [];

// Airbnb予約（蔵王）が入る → 直販と重複
X.applyConfirm_(C, { code: 'HMDUP00001', listingId: L_FOUR, listingTitle: '4名の和室', checkIn: '2026-10-31', checkOut: '2026-11-03', adults: 2, children: 0, infants: 0, name: 'Dana T', checkInTime: '15:00', guestTotal: 30000, payout: 25000, warn: '' }, '2026-10-20', notes);
// 未登録リスティングの予約
X.applyConfirm_(C, { code: 'HMNEW00002', listingId: '999999999999999999', listingTitle: '新しい部屋', checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 1, children: 0, infants: 0, name: 'New L', checkInTime: '15:00', guestTotal: 1, payout: 1, warn: '' }, '2026-10-20', notes);
// 302に2名
res.rows.push({ _row: 3, v: { '媒体': '直販', 'ステータス': '確定', '部屋': '302', 'チェックイン': '2026-11-05', 'チェックアウト': '2026-11-07', '大人': 2, '代表者名': '佐藤' }, dirty: {}, isNew: false });
// 準備中の201
res.rows.push({ _row: 4, v: { '媒体': '直販', 'ステータス': '確定', '部屋': '201', 'チェックイン': '2026-11-05', 'チェックアウト': '2026-11-06', '大人': 1, '代表者名': '鈴木' }, dirty: {}, isNew: false });

X.applyRules_(C, '2026-10-29', notes);
const zaoAirbnb = C.byCode['HMDUP00001'];
assert.strictEqual(zaoAirbnb.v['部屋'], '蔵王');
assert.strictEqual(zaoAirbnb.v['泊数'], 3);
assert.strictEqual(zaoAirbnb.v['入湯税'], 2 * 3 * 300);
assert.ok(/\[重複\]/.test(zaoAirbnb.v['要確認']), zaoAirbnb.v['要確認']);
assert.ok(/\[重複\]/.test(res.rows[0].v['要確認']));
assert.ok(/\[部屋未設定\]/.test(C.byCode['HMNEW00002'].v['要確認']));
assert.ok(/\[定員超え\]/.test(res.rows[1 + 0 + 2].v['要確認'] || res.rows.find(r => r.v['代表者名'] === '佐藤').v['要確認']));
assert.ok(/\[準備中の部屋\]/.test(res.rows.find(r => r.v['代表者名'] === '鈴木').v['要確認']));
console.log('OK ルール：重複・部屋未設定・定員超え・準備中・入湯税');
console.log('   通知:', notes);

// 2回目は同じ札で再通知しない
const notes2 = [];
X.applyRules_(C, '2026-10-29', notes2);
assert.strictEqual(notes2.length, 0, JSON.stringify(notes2));
console.log('OK 同じ問題は2回通知しない');

// 直販をキャンセル → 重複の札が自動で消える
res.rows[0].v['ステータス'] = 'キャンセル';
X.applyRules_(C, '2026-10-29', []);
assert.ok(!/\[重複\]/.test(zaoAirbnb.v['要確認'] || ''), zaoAirbnb.v['要確認']);
assert.ok(!/\[重複\]/.test(res.rows[0].v['要確認'] || ''));
console.log('OK 片方をキャンセルしたら重複の札が消える');

// Airbnbキャンセルメール
const n3 = [];
X.applyCancel_(C, { code: 'HMDUP00001', listingId: L_FOUR, listingTitle: '', checkIn: '', checkOut: '', guests: '', canceledBy: 'ゲスト' }, n3);
assert.strictEqual(zaoAirbnb.v['ステータス'], 'キャンセル');
console.log('OK キャンセルメールでステータスがキャンセルに →', n3[0]);

// 変更メール → 札、iCalで日程が直る
X.applyConfirm_(C, { code: 'HMCHG00003', listingId: L_FOUR, listingTitle: '', checkIn: '2026-11-20', checkOut: '2026-11-22', adults: 1, children: 0, infants: 0, name: 'Betty', checkInTime: '', guestTotal: 1, payout: 1, warn: '' }, '2026-10-15', []);
const n4 = [];
X.applyChange_(C, { code: 'HMCHG00003', name: 'BETTY' }, n4);
assert.ok(/\[変更\]/.test(C.byCode['HMCHG00003'].v['要確認']));
X.applyIcal_(C, L_FOUR, [{ code: 'HMCHG00003', start: '2026-11-21', end: '2026-11-24' }], '2026-10-29', n4);
assert.strictEqual(C.byCode['HMCHG00003'].v['チェックイン'], '2026-11-21');
assert.strictEqual(C.byCode['HMCHG00003'].v['チェックアウト'], '2026-11-24');
assert.ok(/\[iCalで日程変更\] 11\/20〜11\/22 → 11\/21〜11\/24/.test(C.byCode['HMCHG00003'].v['要確認']));
console.log('OK 変更メール → iCalで日程が自動で直る', n4);

// iCalにない（予約日が昨日以前・未来の予約）→ キャンセル疑い
const n5 = [];
X.applyConfirm_(C, { code: 'HMGONE0004', listingId: L_FOUR, listingTitle: '', checkIn: '2026-12-01', checkOut: '2026-12-02', adults: 1, children: 0, infants: 0, name: 'Gone', checkInTime: '', guestTotal: 1, payout: 1, warn: '' }, '2026-10-20', []);
X.applyConfirm_(C, { code: 'HMTODAY005', listingId: L_FOUR, listingTitle: '', checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 1, children: 0, infants: 0, name: 'Today', checkInTime: '', guestTotal: 1, payout: 1, warn: '' }, '2026-10-29', []);
X.applyIcal_(C, L_FOUR, [{ code: 'HMCHG00003', start: '2026-11-21', end: '2026-11-24' }], '2026-10-29', n5);
assert.ok(/\[iCalにない\]/.test(C.byCode['HMGONE0004'].v['要確認']));
assert.ok(!/\[iCalにない\]/.test(C.byCode['HMTODAY005'].v['要確認'] || ''));
console.log('OK iCalから消えた予約に札（今日入った予約は待つ）', n5);

// iCalにしかない予約 → 行を作って通知はしない。後でメールが来たら札が消える
const n6 = [];
X.applyIcal_(C, L_FOUR, [{ code: 'HMCHG00003', start: '2026-11-21', end: '2026-11-24' }, { code: 'HMONLY0006', start: '2026-12-10', end: '2026-12-12' }], '2026-10-29', n6);
assert.ok(/\[メールなし\]/.test(C.byCode['HMONLY0006'].v['要確認']));
assert.strictEqual(C.byCode['HMONLY0006'].v['部屋'], '蔵王');
X.applyConfirm_(C, { code: 'HMONLY0006', listingId: L_FOUR, listingTitle: '', checkIn: '2026-12-10', checkOut: '2026-12-12', adults: 2, children: 0, infants: 0, name: 'Late Mail', checkInTime: '', guestTotal: 1, payout: 1, warn: '' }, '2026-10-29', n6);
assert.ok(!/\[メールなし\]/.test(C.byCode['HMONLY0006'].v['要確認'] || ''));
assert.strictEqual(C.byCode['HMONLY0006'].v['代表者名'], 'Late Mail');
console.log('OK iCalだけの予約 → 後からメールで名前・人数が埋まって札が消える');

// 入湯税：3/31までの予約は150円
const old = X.newRow_(C.res, { '媒体': '直販', 'ステータス': '確定', '部屋': '301', 'チェックイン': '2026-04-10', 'チェックアウト': '2026-04-12', '大人': 2, '予約日': '2026-03-20', '代表者名': '旧' });
X.applyRules_(C, '2026-04-01', []);
assert.strictEqual(old.v['入湯税'], 2 * 2 * 150);
console.log('OK 入湯税：3/31までの予約は150円で計算');

console.log('\nぜんぶ通った');
});
