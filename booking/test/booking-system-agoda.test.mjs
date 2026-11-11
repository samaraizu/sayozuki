// 取り込みGAS：Agodaのメール。REAL_JA は実物の予約確認書（2026-11 受信）を getPlainBody の形にしたもの（名前・電話はダミー）。
// BODY_JA・英語の本文は、ほかの書き方でも読めることを見る仮のもの
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

const SUBJ = 'Agoda予約ID 1700000001 - 予約確定 Hotel ホテル所在国: Japan';
// 実物の予約確認書（HTMLメール）を getPlainBody にした形。太字は *…*、表のセルは1つずつ改行
const REAL_JA = `ユーザーの傾向と予約実績を一ヶ所で確認できます。
今すぐ貴施設の分析を見る
*Booking ID*
予約ID
1700000002
事前払い
Booking confirmation
*Reservation Information*
予約情報
予約確認書
IATA 00-0 0000 0
*かみのやま温泉 小夜月*
(Property ID 99999999)
*City* 都市 : Yamagata
*Marsha Code :*
*Customer First Name* 宿泊者氏名（名）
HANAKO
*Customer Last Name* 宿泊者氏名（姓）
TEST
*Country of Residence* お住まいの国
Hong Kong SAR, China
*Check-in* チェックイン
15-Nov-2026 (15-11-2026)
*Check-out* チェックアウト
16-Nov-2026 (16-11-2026)
*Other Guests* 同伴者
[RmNo.1] Guest of HANAKO TEST , [RmNo.1] HANAKO TEST
*Room Type*
客室タイプ
*No. of Rooms*
部屋数
*Occupancy*
宿泊可能人数
*No. of Extra Bed*
エキストラベッド数 :
Japanese Room
1
2 Adults
0
料金プラン名: Room Only (Room Only)
*Benefits Included* 料金に含まれる特典
-
*Special Requests* 特別なリクエスト ( All special requests are subject to availability upon arrival. 特別なリクエストは、ホテル側の状況により保証できない場合がございますのでご了承下さい。 )
NonSmoke
*Cancellation Policy* キャンセルポリシー
リスクなし！2026年11月14日の前日までにキャンセルすれば、キャンセル料金は一切かかりません。
Room 部屋
Extra Bed エキストラベッド
Other その他
*From - To* からーまで
*Rates* 料金
November 15, 2026
JPY 5,365.00
*Reference sell rate (incl. taxes & fees)* 表示販売料金（税・サ込み）
JPY 6,097.00
*Compensation* 手数料
Commission 手数料
JPY -732.00
*Net rate (incl. taxes & fees)*
卸値（税・サ込み）
JPY 5,365.00
*Booked and Payable by*
予約者および支払者
Agoda Company Pte, Ltd.
*UPC is hidden as requested, please refer to YCS extranet to obtain the necessary details.*
ご要望通り、UPCは非表示となっています。詳細が必要な場合は、YCSエクストラネットを参照ください。
本ご予約に対して承認は必要はありません。
*Customer Notes* 予約者情報：
顧客情報 - 氏名: HANAKO TEST, 電話番号:000 00000
*ホテルスタッフへの注意事項*
`;

// 上の実物を、テスト用の別の予約に書き換えたもの
const BODY_JA = REAL_JA
  .replace(/1700000002/g, '1700000001')
  .replace(/HANAKO/g, 'TARO').replace(/TEST/g, 'YAMADA')
  .replace('15-Nov-2026 (15-11-2026)', '20-Dec-2026 (20-12-2026)')
  .replace('16-Nov-2026 (16-11-2026)', '22-Dec-2026 (22-12-2026)')
  .replace('Japanese Room\n1\n2 Adults', '和室（温泉付き）\n1\n2 Adults')
  .replace('JPY 6,097.00', 'JPY 48,000.00')
  .replace(/卸値（税・サ込み）\nJPY 5,365.00/, '卸値（税・サ込み）\nJPY 40,800.00')
  .replace('NonSmoke', '到着は18時ごろ');

test('件名で予約IDと種類を決める', () => {
  assert.strictEqual(X.classifyAgoda_(SUBJ), 'confirm');
  assert.strictEqual(X.classifyAgoda_('Agoda予約ID 1700000001 - キャンセル済み Hotel ホテル所在国: Japan'), 'cancel');
  assert.strictEqual(X.classifyAgoda_('Agoda予約ID 1700000001 - 予約変更 Hotel ホテル所在国: Japan'), 'change');
  assert.strictEqual(X.classifyAgoda_('Agoda Booking ID 1700000001 - CONFIRMED'), 'confirm');
  assert.strictEqual(X.classifyAgoda_('Agoda Booking ID: 1700000001 - Cancellation'), 'cancel');
  assert.strictEqual(X.classifyAgoda_('YCS 月次レポートのお知らせ'), null);
  assert.strictEqual(X.classifyAgoda_('Agodaからのお知らせ：予約確定率を上げるには'), null);
});

test('日付は和・英・数字の書き方を読む', () => {
  assert.deepStrictEqual([...X.findDates_('2026年12月20日 〜 2026/12/22')], ['2026-12-20', '2026-12-22']);
  assert.deepStrictEqual([...X.findDates_('15-Nov-2026 (15-11-2026)')], ['2026-11-15']);
  assert.deepStrictEqual([...X.findDates_('20 Dec 2026 - Jan 3, 2027')], ['2026-12-20', '2027-01-03']);
});

test('予約確定：台帳に1行足し、部屋タイプを「Agoda」タブに足す。紐付ければ部屋が入る', () => {
  const p = X.parseAgoda_('confirm', SUBJ, BODY_JA, '2026-11-11');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.code, '1700000001');
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

test('現地払い・2室・読めない欄は [Agoda要確認]', () => {
  const body = BODY_JA
    .replace('Japanese Room', 'x')
    .replace('和室（温泉付き）\n1\n2 Adults', '和室（温泉付き）\n2\n4 Adults')
    .replace(/顧客情報 - 氏名: [^,]+,/, '顧客情報 -')
    .replace(/\*Customer First Name\*[\s\S]*?\*Country/, '*Country')
    .replace('事前払い', '現地払い');
  const p = X.parseAgoda_('confirm', SUBJ, body, '2026-11-11');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.adults, 4);
  assert.strictEqual(p.payAtHotel, true);
  const res = table([]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([]));
  X.applyMail_(c, p, '2026-11-11', []);
  assert.strictEqual(res.rows[0].v['支払い状況'], '未収');
  const tag = X.tagsOf_(res.rows[0]).find(t => t.startsWith(X.TAG.AGODA_READ));
  assert.ok(tag.includes('名前が読めない') && tag.includes('2室の予約'), tag);
});

test('日程が読めない予約確定は行を作らず、要手入力にする', () => {
  const p = X.parseAgoda_('confirm', SUBJ, '予約ID: 1700000001\n詳細はYCSで確認してください', '2026-11-11');
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.code, '1700000001');
});

test('キャンセル・変更', () => {
  const res = table([]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([{ 'Agodaの部屋タイプ': '和室（温泉付き）', '部屋': '月山' }]));
  X.applyMail_(c, X.parseAgoda_('confirm', SUBJ, BODY_JA, '2026-11-11'), '2026-11-11', []);
  const r = res.rows[0];

  const notes = [];
  const changed = BODY_JA.replace('22-Dec-2026 (22-12-2026)', '23-Dec-2026 (23-12-2026)');
  X.applyMail_(c, X.parseAgoda_('change', 'Agoda予約ID 1700000001 - 予約変更', changed, '2026-11-12'), '2026-11-12', notes);
  assert.strictEqual(r.v['チェックアウト'], '2026-12-23');
  assert.ok(X.tagsOf_(r).some(t => t.startsWith(X.TAG.CHANGED)));
  assert.ok(notes.some(n => n.includes('12/20〜12/22 → 12/20〜12/23')));

  const cn = [];
  const pc = X.parseAgoda_('cancel', 'Agoda予約ID 1700000001 - キャンセル済み Hotel ホテル所在国: Japan', '本予約はキャンセルされました。', '2026-11-13');
  assert.strictEqual(pc.ok, true);
  assert.strictEqual(X.applyMail_(c, pc, '2026-11-13', cn), 'キャンセルにした');
  assert.strictEqual(r.v['ステータス'], 'キャンセル');
  assert.ok(cn[0].startsWith('キャンセル（Agoda）'));
  assert.strictEqual(X.applyMail_(c, pc, '2026-11-13', []), '既にキャンセルだった');
  assert.strictEqual(res.rows.length, 1);
});

test('手で転送したAgodaのメールも読む（転送元ヘッダーが agoda.com のときだけ）', () => {
  const c2 = vm.createContext({ console });
  vm.runInContext(src + '\n;this.__y = { isForwardedFrom_, parseAgoda_, classifyAgoda_ };', c2);
  const Y = c2.__y;
  const msg = (subject, body) => ({ getSubject: () => subject, getPlainBody: () => body });
  const fwdBody = `---------- Forwarded message ---------
From: agoda.com <no-reply@agoda.com>
Date: 2026年11月10日(火) 10:00
Subject: Agoda予約ID 1700000001 - 予約確定 Hotel ホテル所在国: Japan
To: <someone@example.com>

` + BODY_JA;
  const fwdSubj = 'Fwd: ' + SUBJ;
  assert.strictEqual(Y.isForwardedFrom_(msg(fwdSubj, fwdBody), /agoda/i), true);
  assert.strictEqual(Y.isForwardedFrom_(msg(fwdSubj, fwdBody.replace('agoda.com <no-reply@agoda.com>', 'x <x@example.com>')), /agoda/i), false);
  assert.strictEqual(Y.isForwardedFrom_(msg(SUBJ, fwdBody), /agoda/i), false);
  assert.strictEqual(Y.classifyAgoda_(fwdSubj), 'confirm');
  const p = Y.parseAgoda_('confirm', fwdSubj, fwdBody, '2026-11-12');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.checkIn, '2026-12-20');
  assert.strictEqual(p.checkOut, '2026-12-22');
  assert.strictEqual(p.name, 'TARO YAMADA');
});


test('実物の予約確認書を読む', () => {
  const p = X.parseAgoda_('confirm', 'Agoda予約ID 1700000002 - 予約確定 Hotel ホテル所在国: Japan', REAL_JA, '2026-11-11');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.code, '1700000002');
  assert.strictEqual(p.checkIn, '2026-11-15');
  assert.strictEqual(p.checkOut, '2026-11-16');
  assert.strictEqual(p.roomType, 'Japanese Room');
  assert.strictEqual(p.adults, 2);
  assert.strictEqual(p.children, 0);
  assert.strictEqual(p.name, 'HANAKO TEST');
  assert.strictEqual(p.contact, '000 00000');
  assert.strictEqual(p.guestTotal, 6097);
  assert.strictEqual(p.payout, 5365);
  assert.strictEqual(p.payAtHotel, false);
  assert.strictEqual(p.request, 'NonSmoke');
  assert.strictEqual(p.warns.length, 0, p.warns.join());

  // 名前が予約者情報にないときは、姓・名の欄から
  const p2 = X.parseAgoda_('confirm', 'Agoda予約ID 1700000002 - 予約確定', REAL_JA.replace(/\*Customer Notes\*[\s\S]*$/, ''), '2026-11-11');
  assert.strictEqual(p2.name, 'HANAKO TEST');
});

test('読み方を直したあとの読み直し（refresh）：古い読み取りを上書きし、手で選んだ部屋は残す', () => {
  const res = table([{ '媒体': 'Agoda', '予約番号': '1700000002', 'ステータス': '確定', 'チェックイン': '2026-11-15', 'チェックアウト': '2026-11-16',
    '部屋': '月山', 'リスティングID': 'No. of Rooms', '大人': '', '代表者名': '', 'ゲスト支払額': 6097,
    'メモ': 'Agodaの要望：通り、UPCは非表示となっています。', '要確認': '[Agoda要確認] 名前が読めない。YCSで確認' }]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([]));
  const p = X.parseAgoda_('confirm', 'Agoda予約ID 1700000002 - 予約確定', REAL_JA, '2026-11-11');
  p.refresh = true;
  const notes = [];
  assert.strictEqual(X.applyMail_(c, p, '2026-11-11', notes), '読み直した');
  const r = res.rows[0];
  assert.strictEqual(r.v['代表者名'], 'HANAKO TEST');
  assert.strictEqual(r.v['大人'], 2);
  assert.strictEqual(r.v['連絡先'], '000 00000');
  assert.strictEqual(r.v['リスティングID'], 'Japanese Room');
  assert.strictEqual(r.v['部屋'], '月山');
  assert.strictEqual(r.v['メモ'], 'Agodaの要望：NonSmoke');
  assert.strictEqual(X.tagsOf_(r).length, 0);
  assert.ok(!notes.some(n => n.startsWith('新しい予約')));
});
