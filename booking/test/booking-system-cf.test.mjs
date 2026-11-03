// 取り込みGASの Cloudflare版との同期部分（台帳に足す・送る中身）
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const src = fs.readFileSync(new URL('../booking-system/Code.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;this.__x = { cfAppendPending_, cfPayload_, makeCtx_, newRow_ };', ctx);
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
