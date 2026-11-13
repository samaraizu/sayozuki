// Googleカレンダー連携のテスト（CalendarAppは偽物）
// 取り込みGAS（booking-system/Code.js）を Node の vm で読み込み、GASの部品は偽物で動かす
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const CODE = new URL('../booking-system/Code.js', import.meta.url);

test('取り込みGAS：Googleカレンダー連携', () => {
const calls = [];
const events = {};
let seq = 0;
function makeEvent(id, title, start, end, opts) {
  const ev = { id, title, start, end, desc: opts.description, color: null, deleted: false };
  return {
    getId: () => id,
    setTitle: t => { calls.push('setTitle'); ev.title = t; },
    setAllDayDates: (s, e) => { calls.push('setAllDayDates'); ev.start = s; ev.end = e; },
    setDescription: d => { calls.push('setDescription'); ev.desc = d; },
    setColor: c => { ev.color = c; },
    deleteEvent: () => { calls.push('deleteEvent'); delete events[id]; },
    _ev: ev,
  };
}
const fakeCal = {
  getName: () => '小夜月 予約',
  getId: () => 'cal1',
  createAllDayEvent: (title, start, end, opts) => {
    calls.push('create');
    const id = 'ev' + (++seq) + '@google.com';
    events[id] = makeEvent(id, title, start, end, opts);
    return events[id];
  },
  getEventById: id => { calls.push('get'); return events[id] || null; },
};
const store = {};
const sandbox = {
  console,
  CalendarApp: {
    getCalendarById: () => fakeCal,
    getOwnedCalendarsByName: () => [],
    createCalendar: () => fakeCal,
    EventColor: { RED: 'red', ORANGE: 'orange', BLUE: 'blue', YELLOW: 'yellow', GRAY: 'gray' },
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => store[k] || null, setProperty: (k, v) => { store[k] = v; }, deleteProperty: k => { delete store[k]; } }) },
  Session: { getScriptTimeZone: () => 'Asia/Tokyo' },
  Utilities: { parseDate: (iso) => iso + 'T00:00+09:00' },
};
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(CODE, 'utf8') + '\n;this.__x = { calendarPlan_, syncCalendar_, makeCtx_, applyRules_, newRow_ };', ctx);
const X = ctx.__x;

function table(rows) { return { rows: rows.map(v => ({ _row: 2, v, dirty: {}, isNew: false })) }; }
const res = table([
  { '媒体': 'Airbnb', '予約番号': 'HMAAAA1111', 'ステータス': '確定', '部屋': '蔵王', 'チェックイン': '2026-10-31', 'チェックアウト': '2026-11-03', '大人': 2, '代表者名': 'Pat Q', '到着予定': '15:00', '予約URL': 'https://www.airbnb.jp/hosting/reservations/details/HMAAAA1111' },
  { '媒体': '直販', '予約番号': '', 'ステータス': '確定', '部屋': '301', 'チェックイン': '2026-11-05', 'チェックアウト': '2026-11-06', '大人': 1, '代表者名': '佐藤' },
  { '媒体': 'Airbnb', '予約番号': 'HMCCCC3333', 'ステータス': 'キャンセル', '部屋': '月山', 'チェックイン': '2026-11-02', 'チェックアウト': '2026-11-09', '大人': 1, '代表者名': 'Carol' },
]);
const C = X.makeCtx_(res, table([]), table([{ '部屋': '蔵王', '定員': 4, '状態': '販売可' }, { '部屋': '301', '定員': 4, '状態': '販売可' }, { '部屋': '月山', '定員': 4, '状態': '販売可' }]));
const URL = 'https://docs.google.com/spreadsheets/d/x';

// 予定の形
const p = X.calendarPlan_(res.rows[0], URL);
assert.strictEqual(p.title, '蔵王｜Pat Q 2名（Airbnb）');
assert.strictEqual(p.start, '2026-10-31');
assert.strictEqual(p.end, '2026-11-03');
assert.strictEqual(p.color, 'ORANGE');
assert.ok(p.desc.indexOf('10/31 チェックイン 〜 11/3 チェックアウト（3泊）') >= 0, p.desc);
assert.ok(p.desc.indexOf('予約画面：https://www.airbnb.jp/hosting/reservations/details/HMAAAA1111') >= 0);
assert.strictEqual(X.calendarPlan_(res.rows[2], URL), null);
console.log('OK 予定の形：', p.title, '\n' + p.desc.split('\n').map(l => '   | ' + l).join('\n'));

// 1回目：キャンセル以外の2件が作られる
X.applyRules_(C, '2026-10-29', []);
let r1 = X.syncCalendar_(C, URL, '2026-10-29', []);
assert.strictEqual(r1, '追加2・更新0・削除0');
assert.strictEqual(Object.keys(events).length, 2);
assert.ok(res.rows[0].v['カレンダーID']);
assert.strictEqual(events[res.rows[1].v['カレンダーID']]._ev.color, 'yellow');
console.log('OK 1回目：', r1);

// 2回目：何も変わってなければカレンダーに一切触らない
calls.length = 0;
const r2 = X.syncCalendar_(C, URL, '2026-10-29', []);
assert.strictEqual(r2, '変更なし');
assert.strictEqual(calls.length, 0);
console.log('OK 2回目：変更なしでカレンダーに触らない');

// 部屋を変えたら更新
res.rows[1].v['部屋'] = '月山';
const r3 = X.syncCalendar_(C, URL, '2026-10-29', []);
assert.strictEqual(r3, '追加0・更新1・削除0');
assert.strictEqual(events[res.rows[1].v['カレンダーID']]._ev.title, '月山｜佐藤 1名（直販）');
console.log('OK 部屋を変えたら予定のタイトルも変わる：', events[res.rows[1].v['カレンダーID']]._ev.title);

// 重複が出たら【要確認】で赤
res.rows.push({ _row: 5, v: { '媒体': 'Airbnb', '予約番号': 'HMDDDD4444', 'ステータス': '確定', '部屋': '蔵王', 'チェックイン': '2026-11-01', 'チェックアウト': '2026-11-02', '大人': 1, '代表者名': 'Dup' }, dirty: {}, isNew: false });
X.applyRules_(C, '2026-10-29', []);
X.syncCalendar_(C, URL, '2026-10-29', []);
const pat = events[res.rows[0].v['カレンダーID']]._ev;
assert.ok(/^【要確認】蔵王｜Pat Q/.test(pat.title), pat.title);
assert.strictEqual(pat.color, 'red');
console.log('OK 重複したら【要確認】・赤：', pat.title);

// キャンセルしたら予定が消える
const patId = res.rows[0].v['カレンダーID'];
res.rows[0].v['ステータス'] = 'キャンセル';
X.applyRules_(C, '2026-10-29', []);
const r5 = X.syncCalendar_(C, URL, '2026-10-29', []);
assert.ok(/削除1/.test(r5), r5);
assert.ok(!events[patId]);
assert.strictEqual(res.rows[0].v['カレンダーID'], '');
console.log('OK キャンセルで予定を削除：', r5);

// カレンダー側で手で消された予定は作り直す
const satoId = res.rows[1].v['カレンダーID'];
delete events[satoId];
res.rows[1].v['メモ'] = '到着遅め';
const r6 = X.syncCalendar_(C, URL, '2026-10-29', []);
assert.ok(/追加1/.test(r6), r6);
assert.notStrictEqual(res.rows[1].v['カレンダーID'], satoId);
console.log('OK 手で消された予定は作り直す：', r6);

console.log('\nカレンダーもぜんぶ通った');
});

test('取り込みGAS：仮の予約は【仮】を付けて灰色でカレンダーに出し、確定したら普通の予定に変わる', () => {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(CODE, 'utf8') + '\n;this.__x = { calendarPlan_ };', ctx);
  const r = { v: { '媒体': '直販', '予約番号': 'SZ-20261120-0001', 'ステータス': '仮', '部屋': '月山', 'チェックイン': '2026-11-20', 'チェックアウト': '2026-11-21', '大人': 2, '代表者名': '山田' } };
  const kari = ctx.__x.calendarPlan_(r, 'https://example.com/sheet');
  assert.strictEqual(kari.title, '【仮】月山｜山田 2名（直販）');
  assert.strictEqual(kari.color, 'GRAY');
  assert.match(kari.desc, /^ステータス：仮/);
  r.v['ステータス'] = '確定';
  const done = ctx.__x.calendarPlan_(r, 'https://example.com/sheet');
  assert.strictEqual(done.title, '月山｜山田 2名（直販）');
  assert.strictEqual(done.color, 'YELLOW');
  assert.notStrictEqual(done.sig, kari.sig); // 署名が変わるので、次の実行で予定が書き換わる
  r.v['ステータス'] = 'キャンセル';
  assert.strictEqual(ctx.__x.calendarPlan_(r, 'https://example.com/sheet'), null);
});
