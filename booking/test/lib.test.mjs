import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// GAS と同じく、lib.js をグローバルに読み込む
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../src/lib.js', import.meta.url), 'utf8'), ctx);
const Lib = ctx.Lib;

const rooms = [
  { name: '301', capacity: 4, state: '販売可' },
  { name: '302', capacity: 1, state: '販売可' },
  { name: '月山', capacity: 4, state: '販売可' },
  { name: '201', capacity: 5, state: '準備中' },
];
const bk = (room, checkIn, checkOut, extra = {}) => ({
  room, checkIn, checkOut, channel: 'Airbnb', status: '確定', name: 'A', adults: '2', ...extra,
});

test('toIso は台帳の表示形式とハイフン形式を読む', () => {
  assert.equal(Lib.toIso('2026/10/10(土)'), '2026-10-10');
  assert.equal(Lib.toIso('2026-11-07'), '2026-11-07');
  assert.equal(Lib.toIso('2026/1/5'), '2026-01-05');
  assert.equal(Lib.toIso('2026/02/30'), '');
  assert.equal(Lib.toIso(''), '');
  assert.equal(Lib.toIso(null), '');
});

test('日付の足し算と泊数は月・年をまたいでも合う', () => {
  assert.equal(Lib.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(Lib.addDays('2026-12-29', 7), '2027-01-05');
  assert.equal(Lib.nightsBetween('2026-10-30', '2026-11-02'), 3);
  assert.equal(Lib.weekday('2026-10-31'), '土');
});

test('重なり判定はチェックアウト日と次のチェックイン日が同じなら重ならない', () => {
  assert.equal(Lib.overlaps('2026-11-01', '2026-11-03', '2026-11-03', '2026-11-05'), false);
  assert.equal(Lib.overlaps('2026-11-01', '2026-11-04', '2026-11-03', '2026-11-05'), true);
  assert.equal(Lib.overlaps('2026-11-02', '2026-11-03', '2026-11-01', '2026-11-05'), true);
});

test('roomAvailability は準備中・埋まり・定員・空きを見分ける', () => {
  const bookings = [
    bk('301', '2026-11-07', '2026-11-10'),
    bk('月山', '2026-11-07', '2026-11-08', { status: 'キャンセル' }),
  ];
  const res = Lib.roomAvailability(rooms, bookings, '2026-11-08', '2026-11-09', 2);
  const by = Object.fromEntries(res.map((r) => [r.name, r]));
  assert.equal(by['301'].available, false);
  assert.equal(by['301'].status, '埋まってる');
  assert.equal(by['302'].status, '人数が入らない');
  assert.equal(by['月山'].available, true, 'キャンセルは数えない');
  assert.equal(by['201'].status, '準備中');
  assert.equal(by['201'].available, false);
});

test('findConflicts は同じ部屋の重なりだけを拾う', () => {
  const list = Lib.findConflicts([
    bk('月山', '2026-11-01', '2026-11-03', { channel: 'Airbnb' }),
    bk('月山', '2026-11-02', '2026-11-04', { channel: '直販' }),
    bk('301', '2026-11-02', '2026-11-04'),
    bk('月山', '2026-11-04', '2026-11-05'),
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].room, '月山');
  assert.equal(list[0].first, '2026-11-02');
});

test('layoutWeek は表示範囲で帯を切り、重なりは別の段に置く', () => {
  const [row301, row302] = Lib.layoutWeek(rooms.slice(0, 2), [
    bk('301', '2026-10-28', '2026-10-31'),
    bk('301', '2026-10-30', '2026-11-01'),
    bk('302', '2026-11-03', '2026-11-12'),
  ], '2026-10-29', 7);
  assert.equal(row301.bars[0].col, 0);
  assert.equal(row301.bars[0].span, 2);
  assert.equal(row301.bars[0].clipStart, true);
  assert.equal(row301.bars[1].lane, 1);
  assert.equal(row301.lanes, 2);
  assert.deepEqual(Array.from(row301.clashDays), [false, true, false, false, false, false, false]);
  assert.equal(row302.bars[0].col, 5);
  assert.equal(row302.bars[0].span, 2);
  assert.equal(row302.bars[0].clipEnd, true);
});

test('要入力と窮屈アラート', () => {
  assert.equal(Lib.needsInput({ name: 'Reserved', adults: '2' }), true);
  assert.equal(Lib.needsInput({ name: '佐藤', adults: '' }), true);
  assert.equal(Lib.needsInput({ name: '佐藤', adults: '1' }), false);
  assert.equal(Lib.isTight(2, 2), true);
  assert.equal(Lib.isTight(2, 1), false);
  assert.equal(Lib.isTight(1, 5), false);
});

test('予約番号は SZ-yyyyMMdd-4桁で、既存と被らない', () => {
  const seq = [0.1234, 0.1234, 0.0005];
  const no = Lib.makeBookingNo('2026-10-31', { 'SZ-20261031-1234': true }, () => seq.shift());
  assert.equal(no, 'SZ-20261031-0005');
});

test('validateManual', () => {
  const ok = {
    checkIn: '2026-11-07', checkOut: '2026-11-09', room: '301', people: 2,
    name: '佐藤', contact: '090', payment: '当日Square',
  };
  assert.equal(Lib.validateManual(ok, rooms, '2026-10-31'), '');
  assert.match(Lib.validateManual({ ...ok, checkOut: '2026-11-07' }, rooms, '2026-10-31'), /前/);
  assert.match(Lib.validateManual({ ...ok, room: '201' }, rooms, '2026-10-31'), /売ってない/);
  assert.match(Lib.validateManual({ ...ok, room: '302' }, rooms, '2026-10-31'), /定員1/);
  assert.match(Lib.validateManual({ ...ok, name: ' ' }, rooms, '2026-10-31'), /ゲスト名/);
  assert.match(Lib.validateManual({ ...ok, payment: '現金' }, rooms, '2026-10-31'), /支払い/);
  assert.match(Lib.validateManual({ ...ok, checkIn: '2026-10-01' }, rooms, '2026-10-31'), /過ぎた日/);
});
