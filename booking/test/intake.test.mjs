import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// 受付用GAS（intake/src/Intake.js）の、GASのAPIを使わない部分だけを試す
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../intake/src/Intake.js', import.meta.url), 'utf8'), ctx);

const ok = {
  id: 'HP-20261201-a1b2c3', lang: 'en', name: 'Test Guest', email: 'g@example.com', tel: '090-0000-0000',
  checkin: '2026-12-10', nights: 2, guests: 3, room: '201号室', meal: 'both', message: 'Parking?',
};

test('cleanRecord_ は必須が欠けた中身を断る', () => {
  assert.equal(ctx.cleanRecord_({ ...ok, id: 'x' }), null);
  assert.equal(ctx.cleanRecord_({ ...ok, name: ' ' }), null);
  assert.equal(ctx.cleanRecord_({ ...ok, email: 'nope' }), null);
});

test('cleanRecord_ は範囲外の値を丸め、知らない食事と日付を捨てる', () => {
  const r = ctx.cleanRecord_({ ...ok, nights: 999, guests: -1, meal: 'toString', checkin: '12/10', name: 'a'.repeat(300) });
  assert.equal(r.nights, 30);
  assert.equal(r.guests, 1);
  assert.equal(r.meal, '');
  assert.equal(r.checkin, '');
  assert.equal(r.name.length, 100);
  assert.equal(ctx.cleanRecord_(ok).meal, '1泊2食付き');
});

test('inquiryRow_ は見出しの並びに合わせ、文字を数式にさせない', () => {
  const headers = ['人数', '受付番号', '知らない列', 'お名前', '電話', '状態'];
  const row = ctx.inquiryRow_(headers, ctx.cleanRecord_({ ...ok, name: '=HYPERLINK("http://x")', tel: '+81 90' }), '2026/12/01 10:00');
  assert.deepEqual(Array.from(row), [3, 'HP-20261201-a1b2c3', '', '\'=HYPERLINK("http://x")', "'+81 90", '未対応']);
});

test('sameText_ は合言葉を照合する', () => {
  assert.equal(ctx.sameText_('abc', 'abc'), true);
  assert.equal(ctx.sameText_('abc', 'abd'), false);
  assert.equal(ctx.sameText_('ab', 'abc'), false);
});

test('occupancy_ は部屋ごとの埋まっている夜を返す（キャンセル・範囲外・部屋なしは数えない）', () => {
  const rooms = [
    { '部屋': '201', '定員': '5', '状態': '準備中' },
    { '部屋': '蔵王', '定員': '4', '状態': '販売可' },
    { '部屋': '月山', '定員': '4', '状態': '販売可' },
  ];
  const bookings = [
    { '部屋': '蔵王', 'ステータス': '確定', 'チェックイン': '2026/10/31(土)', 'チェックアウト': '2026/11/03(火)' },
    { '部屋': '蔵王', 'ステータス': 'キャンセル', 'チェックイン': '2026/11/05', 'チェックアウト': '2026/11/06' },
    { '部屋': '月山', 'ステータス': '仮', 'チェックイン': '2026-11-09', 'チェックアウト': '2026-11-12' },
    { '部屋': '', 'ステータス': '確定', 'チェックイン': '2026-11-04', 'チェックアウト': '2026-11-05' },
    { '部屋': '302', 'ステータス': '確定', 'チェックイン': '2026-11-04', 'チェックアウト': '2026-11-05' },
  ];
  const r = ctx.occupancy_(rooms, bookings, '2026-11-02', 9);
  assert.equal(r.until, '2026-11-11');
  const by = Object.fromEntries(Array.from(r.rooms).map((x) => [x.name, x]));
  assert.deepEqual(Object.keys(by), ['201', '蔵王', '月山']);
  assert.equal(by['201'].state, '準備中');
  assert.deepEqual(Array.from(by['蔵王'].booked), ['2026-11-02']);
  assert.deepEqual(Array.from(by['月山'].booked), ['2026-11-09', '2026-11-10']);
  // 名前や予約番号は返さない
  assert.deepEqual(Object.keys(by['月山']).sort(), ['booked', 'capacity', 'name', 'state']);
});
