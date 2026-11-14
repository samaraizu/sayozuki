// 満室アラート（checkFullRooms_）のテスト
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const src = fs.readFileSync(new URL('../booking-system/Code.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;this.__x = { checkFullRooms_, makeCtx_, nightsOf_, addDays_ };', ctx);
const X = ctx.__x;

const table = (rows) => ({ rows: rows.map((v, i) => ({ _row: i + 2, v, dirty: {}, isNew: false })) });
const rooms = () => table([
  { '部屋': '301', '定員': 4, '状態': '販売可' },
  { '部屋': '月山', '定員': 4, '状態': '販売可' },
  { '部屋': '201', '定員': 5, '状態': '準備中' },
]);
const airbnb = () => table([
  { 'リスティングID': 'L-GASSAN', '部屋': '月山' },
  { 'リスティングID': 'L-301', '部屋': '301' },
]);
const agoda = () => table([{ 'Agodaの部屋タイプ': 'Japanese Room', '部屋': '' }]);
const bk = (o) => ({ 'ステータス': '確定', '大人': 2, ...o });
const TODAY = '2026-11-14';
const NOW = new Date('2026-11-14T10:00:00+09:00');
const rowsOf = (close) => close.rows.map((r) => [r.v['状態'], r.v['媒体'], r.v['対象'], r.v['日付']].join(' '));

test('日付の部品', () => {
  assert.deepStrictEqual([...X.nightsOf_('2026-12-30', '2027-01-02')], ['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.strictEqual(X.addDays_('2026-02-28', 1), '2026-03-01');
});

test('Airbnb：ほかの媒体で埋まった夜は「未」で出して知らせる。Airbnb自身の予約・閉じてある夜は出さない', () => {
  const res = table([
    bk({ '媒体': '直販', '予約番号': 'SZ-1', '部屋': '月山', 'チェックイン': '2026-11-15', 'チェックアウト': '2026-11-17', '代表者名': 'BAR送客' }),
    bk({ '媒体': 'Airbnb', '予約番号': 'HMAAAAAAAA', 'リスティングID': 'L-GASSAN', '部屋': '月山', 'チェックイン': '2026-11-20', 'チェックアウト': '2026-11-21' }),
    bk({ '媒体': '直販', '予約番号': 'SZ-2', '部屋': '月山', 'チェックイン': '2026-11-28', 'チェックアウト': '2026-11-29' }),
    bk({ '媒体': '直販', '予約番号': 'SZ-3', 'ステータス': 'キャンセル', '部屋': '月山', 'チェックイン': '2026-12-01', 'チェックアウト': '2026-12-02' }),
    bk({ '媒体': '直販', '予約番号': 'SZ-OLD', '部屋': '月山', 'チェックイン': '2026-11-10', 'チェックアウト': '2026-11-12' }),
  ]);
  const c = X.makeCtx_(res, airbnb(), rooms(), null);
  c.icalNights = { 'L-GASSAN': { '2026-11-20': true, '2026-11-28': true }, 'L-301': {} };
  const close = table([]);
  const notes = [];
  X.checkFullRooms_(c, close, TODAY, NOW, notes);
  assert.deepStrictEqual(rowsOf(close), ['未 Airbnb L-GASSAN 2026-11-15', '未 Airbnb L-GASSAN 2026-11-16']);
  assert.strictEqual(close.rows[0].v['部屋'], '月山');
  assert.match(close.rows[0].v['理由'], /BAR送客（直販）/);
  assert.deepStrictEqual(notes, ['満室アラート：Airbnb（月山）の 11/15・11/16 を閉じて（「閉じる作業」タブ）']);

  // 2回目：何も変わらなければ、行も通知も増えない
  const notes2 = [];
  X.checkFullRooms_(c, close, TODAY, NOW, notes2);
  assert.strictEqual(close.rows.length, 2);
  assert.deepStrictEqual(notes2, []);

  // Airbnbで閉じた → iCalに載る → 自動で「済」
  c.icalNights['L-GASSAN']['2026-11-15'] = true;
  c.icalNights['L-GASSAN']['2026-11-16'] = true;
  X.checkFullRooms_(c, close, TODAY, NOW, notes2);
  assert.deepStrictEqual(rowsOf(close), ['済 Airbnb L-GASSAN 2026-11-15', '済 Airbnb L-GASSAN 2026-11-16']);
  assert.deepStrictEqual(notes2, []);

  // 予約がキャンセル → まだ閉じたまま → 「開け直す」で知らせる
  res.rows[0].v['ステータス'] = 'キャンセル';
  const notes3 = [];
  X.checkFullRooms_(c, close, TODAY, NOW, notes3);
  assert.deepStrictEqual(rowsOf(close), ['開け直す Airbnb L-GASSAN 2026-11-15', '開け直す Airbnb L-GASSAN 2026-11-16']);
  assert.deepStrictEqual(notes3, ['満室アラート：Airbnb（月山）の 11/15・11/16 を開け直して（予約がなくなった）（「閉じる作業」タブ）']);

  // Airbnbで開け直した → 自動で「開け直し済」。通知はなし
  delete c.icalNights['L-GASSAN']['2026-11-15'];
  delete c.icalNights['L-GASSAN']['2026-11-16'];
  const notes4 = [];
  X.checkFullRooms_(c, close, TODAY, NOW, notes4);
  assert.deepStrictEqual(rowsOf(close), ['開け直し済 Airbnb L-GASSAN 2026-11-15', '開け直し済 Airbnb L-GASSAN 2026-11-16']);
  assert.deepStrictEqual(notes4, []);
});

test('Airbnb：閉じる前に理由が消えたら「不要」。iCalが取れない回は閉じたか分からないので「未」のまま', () => {
  const res = table([bk({ '媒体': 'Agoda', '予約番号': '1796000001', '部屋': '301', 'チェックイン': '2026-11-20', 'チェックアウト': '2026-11-21' })]);
  const c = X.makeCtx_(res, airbnb(), rooms(), null); // icalNights なし＝取れなかった
  const close = table([]);
  X.checkFullRooms_(c, close, TODAY, NOW, []);
  assert.deepStrictEqual(rowsOf(close), ['未 Airbnb L-301 2026-11-20']);
  X.checkFullRooms_(c, close, TODAY, NOW, []);
  assert.deepStrictEqual(rowsOf(close), ['未 Airbnb L-301 2026-11-20']);
  res.rows[0].v['ステータス'] = 'キャンセル';
  X.checkFullRooms_(c, close, TODAY, NOW, []);
  assert.deepStrictEqual(rowsOf(close), ['不要 Airbnb L-301 2026-11-20']);
});

test('Agoda：候補の部屋がすべて埋まり、Agoda以外の予約がある夜だけ出す。済は人が付け、理由が消えたら開け直す', () => {
  const res = table([
    bk({ '媒体': '直販', '予約番号': 'SZ-1', '部屋': '301', 'チェックイン': '2026-11-28', 'チェックアウト': '2026-11-29' }),
    bk({ '媒体': 'Airbnb', '予約番号': 'HMBBBBBBBB', 'リスティングID': 'L-GASSAN', '部屋': '月山', 'チェックイン': '2026-11-27', 'チェックアウト': '2026-11-29' }),
    // 11/30 はどちらもAgoda（Agodaが自分で閉じている）
    bk({ '媒体': 'Agoda', '予約番号': '1796000002', '部屋': '301', 'チェックイン': '2026-11-30', 'チェックアウト': '2026-12-01' }),
    bk({ '媒体': 'Agoda', '予約番号': '1796000003', '部屋': '月山', 'チェックイン': '2026-11-30', 'チェックアウト': '2026-12-01' }),
  ]);
  const c = X.makeCtx_(res, table([]), rooms(), agoda()); // 201は準備中なので候補外
  const close = table([]);
  const notes = [];
  X.checkFullRooms_(c, close, TODAY, NOW, notes);
  assert.deepStrictEqual(rowsOf(close), ['未 Agoda Japanese Room 2026-11-28']);
  assert.strictEqual(close.rows[0].v['部屋'], '301,月山');
  assert.deepStrictEqual(notes, ['満室アラート：Agoda「Japanese Room」の 11/28 を閉じて（「閉じる作業」タブ）']);

  close.rows[0].v['状態'] = '済'; // 人がAgodaで閉じて付けた
  X.checkFullRooms_(c, close, TODAY, NOW, []);
  assert.strictEqual(close.rows[0].v['状態'], '済');

  res.rows[0].v['ステータス'] = 'キャンセル';
  const notes2 = [];
  X.checkFullRooms_(c, close, TODAY, NOW, notes2);
  assert.strictEqual(close.rows[0].v['状態'], '開け直す');
  assert.deepStrictEqual(notes2, ['満室アラート：Agoda「Japanese Room」の 11/28 を開け直して（予約がなくなった）（「閉じる作業」タブ）']);

  // 「Agoda」タブで候補の部屋を絞ると、その部屋だけで判定する
  const c2 = X.makeCtx_(table([bk({ '媒体': '直販', '予約番号': 'SZ-9', '部屋': '301', 'チェックイン': '2026-12-05', 'チェックアウト': '2026-12-06' })]),
    table([]), rooms(), table([{ 'Agodaの部屋タイプ': 'Twin', '部屋': '301' }]));
  const close2 = table([]);
  X.checkFullRooms_(c2, close2, TODAY, NOW, []);
  assert.deepStrictEqual(rowsOf(close2), ['未 Agoda Twin 2026-12-05']);
});

test('過ぎた夜の行は触らない', () => {
  const c = X.makeCtx_(table([]), airbnb(), rooms(), null);
  c.icalNights = { 'L-GASSAN': {}, 'L-301': {} };
  const close = table([{ '状態': '済', '媒体': 'Airbnb', '対象': 'L-GASSAN', '部屋': '月山', '日付': '2026-11-01' }]);
  X.checkFullRooms_(c, close, TODAY, NOW, []);
  assert.strictEqual(close.rows[0].v['状態'], '済');
});
