// 取り込みGAS：Expediaのメール。SHOT は 2026-11-19 受信の実物（Hotels.com 経由・現地払い）の上半分を
// getPlainBody の形にしたもの（名前・電話・番号はダミー）。下半分（日程・人数・金額）は Partner Central の
// 通知メールの見出しに合わせた仮のもの。実物で読めない欄があれば [Expedia要確認] が付く
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const src = fs.readFileSync(new URL('../booking-system/Code.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;this.__x = { htmlText_, classifyExpedia_, parseExpedia_, applyMail_, applyRules_, calendarPlan_, checkFullRooms_, makeCtx_, tagsOf_, TAG };', ctx);
const X = ctx.__x;
const table = (rows) => ({ rows: rows.map((v, i) => ({ _row: i + 2, v, dirty: {}, isNew: false })) });
const ROOMS = [{ '部屋': '302', '定員': 1, '状態': '販売可' }, { '部屋': '301', '定員': 4, '状態': '販売可' }, { '部屋': '月山', '定員': 4, '状態': '販売可' }];

const SUBJ = 'Expedia - New Booking - Arriving on 21 Nov 2026';
const SHOT = `NOTICE: The following notice is for hotel partners only. All other vendors (including Activity Service Providers) please disregard.
HOTEL RESERVATION CONFIRMATIONS: Please provide booking confirmation code.
Enter confirmation code at www.expediapartnercentral.com <https://www.expediapartnercentral.com>
New Reservation
[Hotels.com]
Sayozuki
Kaminoyama,Yamagata,JPN
Hotel Collects Payment from Guest
Reservation ID:
2600000001 <https://apps.expediapartnercentral.com/lodging/reservations/reservationDetails.html?htid=99999999&reservationIds=2600000001>
Guest: TARO TEST
81 9000000000
Booked on: Nov 19, 2026
6:55 AM PST
Guest Email: dummy@m.expediapartnercentral.com
Room Type Code: RoomCode
Room Type Name: Japanese-Style Room, Private Bathroom
Rate Plan Code: RP0001
Check-In: Nov 21, 2026
Check-Out: Nov 23, 2026
Adults: 2
Kids/Ages: 0
Special Request: Non-smoking
Total Booking Amount: JPY 32,000.00
`;

test('件名で種類を決める（Hotels.com 経由でも件名は Expedia）', () => {
  assert.strictEqual(X.classifyExpedia_(SUBJ), 'confirm');
  assert.strictEqual(X.classifyExpedia_('Expedia - Cancelled Booking - Arriving on 21 Nov 2026'), 'cancel');
  assert.strictEqual(X.classifyExpedia_('Expedia - Modified Booking - Arriving on 21 Nov 2026'), 'change');
  assert.strictEqual(X.classifyExpedia_('Fwd: Expedia - New Booking - Arriving on 21 Nov 2026'), 'confirm');
  assert.strictEqual(X.classifyExpedia_('Expedia Partner Central: Your monthly statement'), null);
});

test('予約確定（実物の形）：番号・日程・人数・名前・電話・部屋タイプ・現地払い', () => {
  const p = X.parseExpedia_('confirm', SUBJ, SHOT, '2026-11-19');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.code, '2600000001');
  assert.strictEqual(p.checkIn, '2026-11-21');
  assert.strictEqual(p.checkOut, '2026-11-23');
  assert.strictEqual(p.adults, 2);
  assert.strictEqual(p.children, 0);
  assert.strictEqual(p.name, 'TARO TEST');
  assert.strictEqual(p.contact, '+81 9000000000');
  assert.strictEqual(p.roomType, 'Japanese-Style Room, Private Bathroom');
  assert.strictEqual(p.payAtHotel, true);
  assert.strictEqual(p.guestTotal, 32000);
  assert.strictEqual(p.request, 'Non-smoking');
  assert.match(p.url, /reservationIds=2600000001/);
  assert.deepStrictEqual([...p.warns], []);
});

test('1行に並んだ形・Expedia Collect・チェックアウトがなければ泊数から', () => {
  const body = `Expedia Collects Payment
Reservation ID: 2600000002 Guest: HANAKO TEST 81 8000000000 Booked on: Nov 19, 2026
Room Type Code: 123456 Room Type Name: Twin Room
Check-In: 2026-12-05 Number of nights: 2
Adults: 1 Kids/Ages: 1/7
Amount Expedia will pay: JPY 20,000
`;
  const p = X.parseExpedia_('confirm', 'Expedia - New Booking - Arriving on 05 Dec 2026', body, '2026-11-19');
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.code, '2600000002');
  assert.strictEqual(p.name, 'HANAKO TEST');
  assert.strictEqual(p.contact, '+81 8000000000');
  assert.strictEqual(p.roomType, 'Twin Room');
  assert.strictEqual(p.checkIn, '2026-12-05');
  assert.strictEqual(p.checkOut, '2026-12-07');
  assert.strictEqual(p.adults, 1);
  assert.strictEqual(p.children, 1);
  assert.strictEqual(p.payAtHotel, false);
  assert.strictEqual(p.payout, 20000);
});

test('日程が読めない予約確定は行を作らない（要手入力）、番号がなければ読めない', () => {
  const p = X.parseExpedia_('confirm', 'Expedia - New Booking', 'Reservation ID: 2600000003\nGuest: A B\n', '2026-11-19');
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.code, '2600000003');
  assert.strictEqual(X.parseExpedia_('confirm', SUBJ, 'Guest: A B', '2026-11-19').ok, false);
});

test('台帳に入れる：部屋タイプの紐付け・自動の部屋決め・未収・確認番号の通知・カレンダー色', () => {
  const res = table([]);
  res.sheet = null;
  const expedia = table([]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([]), expedia);
  const notes = [];
  const p = X.parseExpedia_('confirm', SUBJ, SHOT, '2026-11-19');
  assert.strictEqual(X.applyMail_(c, p, '2026-11-19', notes), '追加');
  const r = res.rows[0];
  assert.strictEqual(r.v['媒体'], 'Expedia');
  assert.strictEqual(r.v['支払い状況'], '未収');
  assert.strictEqual(r.v['リスティングID'], 'Japanese-Style Room, Private Bathroom');
  assert.strictEqual(r.v['メモ'], 'Expediaの要望：Non-smoking');
  assert.strictEqual(expedia.rows.length, 1);
  assert.strictEqual(expedia.rows[0].v['Expediaの部屋タイプ'], 'Japanese-Style Room, Private Bathroom');
  assert.ok(notes.some((n) => /新しい予約（Expedia）/.test(n) && /確認番号/.test(n)));

  X.applyRules_(c, '2026-11-19', notes);
  assert.strictEqual(r.v['部屋'], '301'); // 2名なので定員1の302は飛ばす
  assert.strictEqual(X.calendarPlan_(r, 'https://x').color, 'CYAN');
});

test('キャンセル・変更', () => {
  const res = table([{ '媒体': 'Expedia', '予約番号': '2600000001', 'ステータス': '確定', '部屋': '301', 'チェックイン': '2026-11-21', 'チェックアウト': '2026-11-23', '大人': 2, 'リスティングID': 'Japanese-Style Room, Private Bathroom' }]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([]), table([{ 'Expediaの部屋タイプ': 'Japanese-Style Room, Private Bathroom', '部屋': '' }]));
  const notes = [];
  const ch = X.parseExpedia_('change', 'Expedia - Modified Booking - Arriving on 22 Nov 2026', SHOT.replace('Check-In: Nov 21, 2026', 'Check-In: Nov 22, 2026'), '2026-11-20');
  X.applyMail_(c, ch, '2026-11-20', notes);
  assert.strictEqual(res.rows[0].v['チェックイン'], '2026-11-22');
  assert.ok(X.tagsOf_(res.rows[0]).some((t) => t.startsWith(X.TAG.CHANGED) && /Partner Central/.test(t)));

  const cancelBody = 'Reservation ID: 2600000001\nGuest: TARO TEST\nCheck-In: Nov 22, 2026\nCheck-Out: Nov 23, 2026\n';
  const cn = X.parseExpedia_('cancel', 'Expedia - Cancelled Booking - Arriving on 22 Nov 2026', cancelBody, '2026-11-20');
  assert.strictEqual(X.applyMail_(c, cn, '2026-11-20', notes), 'キャンセルにした');
  assert.strictEqual(res.rows[0].v['ステータス'], 'キャンセル');
  assert.ok(notes.some((n) => /キャンセル（Expedia）/.test(n)));
});

test('満室アラート：Expediaの部屋タイプの候補が他の媒体で埋まった夜は閉じる作業に出る', () => {
  const res = table([{ '媒体': '直販', '予約番号': 'SZ-1', 'ステータス': '確定', '部屋': '301', 'チェックイン': '2026-12-05', 'チェックアウト': '2026-12-06', '大人': 2 }]);
  const close = table([]);
  const c = X.makeCtx_(res, table([]), table(ROOMS), table([]), table([{ 'Expediaの部屋タイプ': 'Twin Room', '部屋': '301' }]));
  const notes = [];
  X.checkFullRooms_(c, close, '2026-11-20', new Date('2026-11-20T00:00:00Z'), notes);
  const row = close.rows.find((r) => r.v['媒体'] === 'Expedia');
  assert.ok(row);
  assert.strictEqual(row.v['対象'], 'Twin Room');
  assert.strictEqual(row.v['日付'], '2026-12-05');
});

// 2026-11-19 受信の実物（Hotels.com 経由・現地払い）の構造。日程・人数は見出しの行 → 値の行の表（名前・電話・番号はダミー）
const REAL_HTML = `<table><tbody><tr><td style="width:30%"><b>Reservation ID: </b><a href="https://x.awstrack.me/L0/https:%2F%2Fapps.expediapartnercentral.com%2Flodging%2Freservations%2FreservationDetails.html%3FreservationIds=2600000001%26htid=1/1/abc=474" target="_blank">2600000001</a></td><td style="width:30%"><b>Guest: </b>TARO  TEST</td><td style="width:40%" align="right">Booked on: Nov 19, 2026 6:55 AM PST</td>
</tr><tr><td style="width:30%"></td><td style="width:30%">81 9000000000</td></tr>
<tr><td colspan="3"><b>Guest Email: </b>dummy@m.expediapartnercentral.com</td></tr>
<tr><td colspan="3">Room Type Code: RoomCode</td></tr>
<tr><td colspan="3"><table><tbody><tr><td>Room Type Name: </td><td style="width:4px"></td><td>Quadruple Room - Standard</td></tr></tbody></table></td></tr>
<tr><td colspan="3">Payment Instructions: Hotel collects payment from the traveler</td></tr>
<tr><td colspan="3"><table><tbody><tr valign="bottom"><td>Check-In</td><td>Check-Out</td><td>Adults</td><td>Kids/Ages</td><td>Room Nights</td><td>Hotel Conf</td></tr>
<tr valign="top"><td>Nov 21, 2026</td><td>Nov 23, 2026</td><td>2</td><td>1
                /12</td><td>2</td><td></td></tr></tbody></table></td></tr>
<tr valign="bottom"><td colspan="3"><b>Special Request</b></td></tr><tr valign="BOTTOM"><td colspan="3"></td></tr>
<tr><td><table><tbody><tr><td colspan="7"><b>Daily Rate - 12,151 JPY</b></td></tr><tr><td>Sat, Nov 21</td><td>Sun, Nov 22</td><td></td></tr></tbody></table></td>
<td><table><tbody><tr><td align="right">Extra Person: </td><td align="right">0 JPY</td></tr><tr><td align="right"><b>Total: </b></td><td align="right"><b>24,302 JPY</b></td></tr></tbody></table></td></tr>
</tbody></table>
`;
const REAL_PLAIN = `Hotel Collects Payment from Guest
*Reservation ID: *2600000001
<https://x.awstrack.me/L0/https:%2F%2Fapps.expediapartnercentral.com%2Flodging%2Freservations%2FreservationDetails.html%3FreservationIds=2600000001%26htid=1/1/abc=474>
*Guest:
*TARO TEST Booked on: Nov 19, 2026 6:55 AM PST
81 9000000000
*Guest Email: *dummy@m.expediapartnercentral.com
Room Type Code: RoomCode
Room Type Name: Quadruple Room - Standard
Payment Instructions: Hotel collects payment from the traveler
Check-In Check-Out Adults Kids/Ages Room Nights Hotel Conf
Nov 21, 2026 Nov 23, 2026 2 1 /12 2
*Special Request*
*Daily Rate - 12,151 JPY*
Sat, Nov 21 Sun, Nov 22
Extra Person: 0 JPY
*Total: * *24,302 JPY*
`;

test('実物の形（HTML本文・getPlainBody とも）：表の日程・人数、次の行の名前、合計、予約画面のURL', () => {
  for (const body of [X.htmlText_(REAL_HTML), REAL_PLAIN]) {
    const p = X.parseExpedia_('confirm', SUBJ, body, '2026-11-19');
    assert.strictEqual(p.ok, true);
    assert.strictEqual(p.code, '2600000001');
    assert.strictEqual(p.checkIn, '2026-11-21');
    assert.strictEqual(p.checkOut, '2026-11-23');
    assert.strictEqual(p.adults, 2);
    assert.strictEqual(p.children, 1);
    assert.strictEqual(p.name, 'TARO TEST');
    assert.strictEqual(p.contact, '+81 9000000000');
    assert.strictEqual(p.roomType, 'Quadruple Room - Standard');
    assert.strictEqual(p.payAtHotel, true);
    assert.strictEqual(p.guestTotal, 24302);
    assert.strictEqual(p.request, '');
    assert.strictEqual(p.url, 'https://apps.expediapartnercentral.com/lodging/reservations/reservationDetails.html?reservationIds=2600000001&htid=1');
    assert.deepStrictEqual([...p.warns], []);
  }
});
