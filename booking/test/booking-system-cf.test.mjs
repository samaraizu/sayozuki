// 取り込みGASの Cloudflare版との同期部分（台帳に足す・送る中身）
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const src = fs.readFileSync(new URL('../booking-system/Code.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;this.__x = { cfAppendPending_, cfApplyCancels_, cfPayload_, makeCtx_, newRow_ };', ctx);
const X = ctx.__x;

const table = (rows) => ({ rows: rows.map((v, i) => ({ _row: i + 2, v, dirty: {}, isNew: false })) });

test('アプリの予約を台帳に足す：番号で重複を防ぎ、人数は数にする', () => {
  const res = table([{ '媒体': 'Airbnb', '予約番号': 'HMAAAA1111', 'チェックイン': '2026-11-05' }]);
  const c = X.makeCtx_(res, table([]), table([]));
  const added = X.cfAppendPending_(c, [
    { '媒体': '直販', '予約番号': 'SZ-20261104-0250', 'ステータス': '確定', '部屋': '蔵王', 'チェックイン': '2026-11-05', 'チェックアウト': '2026-11-07', '大人': '2', 'ゲスト支払額': '36000', '代表者名': '山田' },
    { '媒体': 'Airbnb', '予約番号': 'HMAAAA1111' },
    { '媒体': '直販', '予約番号': '' },
  ]);
  assert.strictEqual(added, 1);
  assert.strictEqual(res.rows.length, 2);
  const r = res.rows[1];
  assert.strictEqual(r.isNew, true);
  assert.strictEqual(r.v['大人'], 2);
  assert.strictEqual(r.v['ゲスト支払額'], 36000);
  assert.strictEqual(r.v['チェックイン'], '2026-11-05');
  assert.strictEqual(c.byCode['SZ-20261104-0250'], r);
  // 2回目は足さない
  assert.strictEqual(X.cfAppendPending_(c, [{ '予約番号': 'SZ-20261104-0250' }]), 0);
});

test('アプリ・HPの予約とアプリのキャンセルは、通知メールに載せる', () => {
  const res = table([{ '媒体': '直販', '予約番号': 'SZ-20261201-0009', 'ステータス': '確定', '部屋': '301', 'チェックイン': '2026-12-01', 'チェックアウト': '2026-12-02', '代表者名': '佐藤' }]);
  const c = X.makeCtx_(res, table([]), table([]));
  const notes = [];
  X.cfAppendPending_(c, [
    { '媒体': '直販', '予約番号': 'SZ-20261202-0001', '部屋': '蔵王', 'チェックイン': '2026-12-02', 'チェックアウト': '2026-12-04', '代表者名': '山田', '支払い状況': '現地でSquare' },
    { '媒体': '直販', '予約番号': 'SZ-20261203-0001', '部屋': '月山', 'チェックイン': '2026-12-03', 'チェックアウト': '2026-12-04', '代表者名': 'Smith', '支払い状況': 'HPで決済済' },
  ], notes);
  X.cfApplyCancels_(c, [{ '予約番号': 'SZ-20261201-0009', 'メモ': 'キャンセル（規定0%）' }], notes);
  assert.deepStrictEqual(notes, [
    '新しい予約（アプリ）：蔵王 12/2〜12/4 山田（直販）',
    '新しい予約（HP）：月山 12/3〜12/4 Smith（直販）',
    'キャンセル（アプリ）：301 12/1〜12/2 佐藤（直販）\n  キャンセル（規定0%）',
  ]);
});

test('送る中身：空行を除き、見出しをCloudflare版の名前にする', () => {
  const res = table([
    { '媒体': 'Airbnb', '予約番号': 'HMAAAA1111', '部屋': '301', 'チェックイン': '2026-11-05', 'チェックアウト': '2026-11-07', '大人': 2, '入湯税': 1200, '要確認': '[変更]' },
    { '媒体': '', '予約番号': '', 'チェックイン': '', '代表者名': '' },
  ]);
  const rooms = table([{ '部屋': '301', '定員': 4, '状態': '販売可' }, { '部屋': '', '定員': '', '状態': '' }]);
  const p = X.cfPayload_(res, rooms, '2026/11/04 10:00');
  assert.strictEqual(p.lastImport, '2026/11/04 10:00');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(p.rooms)), [{ name: '301', capacity: 4, state: '販売可' }]);
  assert.strictEqual(p.bookings.length, 1);
  const b = p.bookings[0];
  assert.strictEqual(b.no, 'HMAAAA1111');
  assert.strictEqual(b.adults, '2');
  assert.strictEqual(b.tax, '1200');
  assert.strictEqual(b.flag, '[変更]');
  assert.strictEqual(b.checkOut, '2026-11-07');
  assert.strictEqual(b.memo, '');
});

test('アプリのキャンセルを台帳に反映：ステータスをキャンセルにし、メモに1行足す（2回目は何もしない）', () => {
  const res = table([
    { '媒体': '直販', '予約番号': 'SZ-20261201-0001', 'ステータス': '確定', 'メモ': 'HP予約・事前決済 27,000円' },
    { '媒体': '直販', '予約番号': 'SZ-20261201-0002', 'ステータス': 'キャンセル', 'メモ': '' },
  ]);
  const c = X.makeCtx_(res, table([]), table([]));
  const list = [
    { '予約番号': 'SZ-20261201-0001', 'メモ': '2026/12/01 10:00 キャンセル（7日前まで・規定0%）支払27,000円・返金27,000円' },
    { '予約番号': 'SZ-20261201-0002', 'メモ': 'x' },
    { '予約番号': 'SZ-NOTHERE', 'メモ': 'x' },
  ];
  assert.strictEqual(X.cfApplyCancels_(c, list), 1);
  const r = res.rows[0];
  assert.strictEqual(r.v['ステータス'], 'キャンセル');
  assert.strictEqual(r.v['メモ'], 'HP予約・事前決済 27,000円\n2026/12/01 10:00 キャンセル（7日前まで・規定0%）支払27,000円・返金27,000円');
  assert.strictEqual(r.dirty['ステータス'], true);
  assert.strictEqual(X.cfApplyCancels_(c, list), 0);
});
