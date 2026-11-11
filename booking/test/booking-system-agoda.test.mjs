// 取り込みGAS：Agodaのメール。件名は実物の形。本文は実物が手元にないので、YCSの通知メールによくある「見出し → 値」の形で作った仮のもの
// （実物が届いたら、名前・番号をダミーにしてここに置き換える）
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const src = fs.readFileSync(new URL('../booking-system/Code.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;this.__x = { classifyAgoda_, parseAgoda_, findDates_, applyMail_, applyRules_, calendarPlan_, makeCtx_, tagsOf_, TAG };', ctx);
const X = ctx.__x;
const table = (rows) => ({ rows: rows.map((v, i) => ({ _row: i + 2, v, dirty: {}, isNew: false })) });
const ROOMS = [{ '部屋': '301', '定員': 4, '状態': '販売可' }, { '部屋': '月山', '定員': 4, '状態': '販売可' }];

const SUBJ = 'Agoda予約ID 1796010901 - 予約確定 Hotel ホテル所在国: Japan';
const BODY_JA = `いつもAgodaをご利用いただきありがとうございます。
新しい予約が入りました。

予約ID: 1796010901
宿泊者名: TARO YAMADA
国籍: Japan
チェックイン: 2026年12月20日
チェックアウト: 2026年12月22日
部屋タイプ: 和室（温泉付き）
部屋数: 1
大人: 2
子供: 0
特別リクエスト: 到着は18時ごろ
販売料金: JPY 48,000
ネット料金: JPY 40,800
https://ycs.agoda.com/ja-jp/HotelBookings/Index/000000
`;

test('件名で予約IDと種類を決める', () => {
  assert.strictEqual(X.classifyAgoda_(SUBJ), 'confirm');
  assert.strictEqual(X.classifyAgoda_('Agoda予約ID 1796010901 - キャンセル済み Hotel ホテル所在国: Japan'), 'cancel');
  assert.strictEqual(X.classifyAgoda_('Agoda予約ID 1796010901 - 予約変更 Hotel ホテル所在国: Japan'), 'change');
  assert.strictEqual(X.classifyAgoda_('Agoda Booking ID 1796010901 - CONFIRMED'), 'confirm');
  assert.strictEqual(X.classifyAgoda_('Agoda Booking ID: 1796010901 - Cancellation'), 'cancel');
  assert.strictEqual(X.classifyAgoda_('YCS 月次レポートのお知らせ'), null);
  assert.strictEqual(X.classifyAgoda_('Agodaからのお知らせ：予約確定率を上げるには'), null);
});

test('日付は和・英・数字の書き方を読む', () => {
  assert.deepStrictEqual([...X.findDates_('2026年12月20日 〜 2026/12/22')], ['2026-12-20', '2026-12-22']);
  assert.deepStrictEqual([...X.findDates_('20 Dec 2026 - Jan 3, 2027')], ['2026-12-20', '2027-01-03']);
});

test('予約確定：台帳に1行足し、部屋タイプを「Agoda」タブに足す。紐付ければ部屋が入る', () => {
  const p = X.parseAgoda_('confirm', SUBJ, BODY_JA, '2026-11-11');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.code, '1796010901');
  assert.strictEqual(p.checkIn, '2026-12-20');
  assert.strictEqual(p.checkOut, '2026-12-22');
  assert.strictEqual(p.adults, 2);
  assert.strictEqual(p.name, 'TARO YAMADA');
  assert.strictEqual(p.roomType, '和室（温泉付き）');
  assert.strictEqual(p.guestTotal, 48000);
  assert.strictEqual(p.payout, 40800);
  assert.strictEqual(p.payAtHotel, false);
  assert.strictEqual(p.warns.length, 0);

  const res = table([]), agoda = table([]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), agoda);
  const notes = [];
  assert.strictEqual(X.applyMail_(c, p, '2026-11-11', notes), '追加');
  const r = res.rows[0];
  assert.strictEqual(r.v['媒体'], 'Agoda');
  assert.strictEqual(r.v['支払い状況'], '媒体で決済済');
  assert.strictEqual(r.v['メモ'], 'Agodaの要望：到着は18時ごろ');
  assert.strictEqual(agoda.rows[0].v['Agodaの部屋タイプ'], '和室（温泉付き）');
  assert.ok(notes.some(n => n.startsWith('新しいAgodaの部屋タイプ')));
  assert.ok(notes.some(n => n.startsWith('新しい予約（Agoda）')));

  X.applyRules_(c, '2026-11-11', []);
  assert.ok(X.tagsOf_(r).some(t => t.includes('「Agoda」タブ')));
  agoda.rows[0].v['部屋'] = '月山';
  X.applyRules_(c, '2026-11-11', []);
  assert.strictEqual(r.v['部屋'], '月山');
  assert.strictEqual(r.v['入湯税'], 2 * 2 * 300);
  assert.strictEqual(X.tagsOf_(r).length, 0);
  assert.strictEqual(X.calendarPlan_(r, 'u').color, 'MAUVE');

  // 同じメールをもう一度読んでも行は増えない
  assert.strictEqual(X.applyMail_(c, p, '2026-11-11', []), '既にあった（空欄だけ埋めた）');
  assert.strictEqual(res.rows.length, 1);
});

test('Airbnbの予約と重なれば [重複]', () => {
  const res = table([{ '媒体': 'Airbnb', '予約番号': 'HMAAAAAAAA', 'ステータス': '確定', '部屋': '月山', 'チェックイン': '2026-12-21', 'チェックアウト': '2026-12-23', '大人': 2, '代表者名': 'A' }]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([{ 'Agodaの部屋タイプ': '和室（温泉付き）', '部屋': '月山' }]));
  X.applyMail_(c, X.parseAgoda_('confirm', SUBJ, BODY_JA, '2026-11-11'), '2026-11-11', []);
  const notes = [];
  X.applyRules_(c, '2026-11-11', notes);
  assert.ok(X.tagsOf_(res.rows[1]).some(t => t.startsWith(X.TAG.DUP)));
  assert.ok(notes.some(n => n.includes(X.TAG.DUP)));
});

test('英語の本文・現地払い・読めない欄は [Agoda要確認]', () => {
  const body = `Booking ID: 1796010902
Guest Name: Jane Doe
Check-in: Dec 20, 2026
Check-out: Dec 21, 2026
Room Type: Japanese Room
No. of rooms: 2
Guests: 3
Pay at the hotel
Total price: ¥30,000`;
  const p = X.parseAgoda_('confirm', 'Agoda Booking ID 1796010902 - CONFIRMED', body, '2026-11-11');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.checkIn, '2026-12-20');
  assert.strictEqual(p.checkOut, '2026-12-21');
  assert.strictEqual(p.name, 'Jane Doe');
  assert.strictEqual(p.adults, 3);
  assert.strictEqual(p.payAtHotel, true);
  assert.strictEqual(p.guestTotal, 30000);
  const res = table([]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([]));
  const notes = [];
  X.applyMail_(c, p, '2026-11-11', notes);
  assert.strictEqual(res.rows[0].v['支払い状況'], '未収');
  const tag = X.tagsOf_(res.rows[0]).find(t => t.startsWith(X.TAG.AGODA_READ));
  assert.ok(tag.includes('人数は合計しか読めない') && tag.includes('2室の予約'));
});

test('日程が読めない予約確定は行を作らず、要手入力にする', () => {
  const p = X.parseAgoda_('confirm', SUBJ, '予約ID: 1796010901\n詳細はYCSで確認してください', '2026-11-11');
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.code, '1796010901');
});

test('キャンセル・変更', () => {
  const res = table([]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([{ 'Agodaの部屋タイプ': '和室（温泉付き）', '部屋': '月山' }]));
  X.applyMail_(c, X.parseAgoda_('confirm', SUBJ, BODY_JA, '2026-11-11'), '2026-11-11', []);
  const r = res.rows[0];

  const notes = [];
  const changed = BODY_JA.replace('2026年12月22日', '2026年12月23日');
  X.applyMail_(c, X.parseAgoda_('change', 'Agoda予約ID 1796010901 - 予約変更', changed, '2026-11-12'), '2026-11-12', notes);
  assert.strictEqual(r.v['チェックアウト'], '2026-12-23');
  assert.ok(X.tagsOf_(r).some(t => t.startsWith(X.TAG.CHANGED)));
  assert.ok(notes.some(n => n.includes('12/20〜12/22 → 12/20〜12/23')));

  const cn = [];
  const pc = X.parseAgoda_('cancel', 'Agoda予約ID 1796010901 - キャンセル済み Hotel ホテル所在国: Japan', '本予約はキャンセルされました。', '2026-11-13');
  assert.strictEqual(pc.ok, true);
  assert.strictEqual(X.applyMail_(c, pc, '2026-11-13', cn), 'キャンセルにした');
  assert.strictEqual(r.v['ステータス'], 'キャンセル');
  assert.ok(cn[0].startsWith('キャンセル（Agoda）'));
  assert.strictEqual(X.applyMail_(c, pc, '2026-11-13', []), '既にキャンセルだった');
  assert.strictEqual(res.rows.length, 1);
});
