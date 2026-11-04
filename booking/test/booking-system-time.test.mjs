// 到着予定（時刻だけの列）の読み込みのテスト
// スプシは「15:00」を 1899/12/30 15:00（日本時間）の日時として返す。台帳を読むときに「15:00」に直す
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';
import { test } from 'node:test';

const CODE = new URL('../booking-system/Code.js', import.meta.url);

test('取り込みGAS：到着予定は「15:00」の形で読む', () => {
  const sandbox = {
    console,
    Utilities: {
      formatDate: (d, tz, fmt) => {
        assert.equal(fmt, 'HH:mm');
        return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
      },
    },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(CODE, 'utf8') + '\n;this.__x = { loadTable_ };', ctx);
  const X = ctx.__x;

  const header = ['予約番号', 'チェックイン', '到着予定', 'メモ'];
  const rows = [
    ['HMAAAA1111', '', new Date('1899-12-30T15:00:00+09:00'), ''],
    ['HMBBBB2222', '', new Date('1899-12-30T20:30:00+09:00'), '20時ごろ'],
    ['HMCCCC3333', '', '夕方', ''],
    ['HMDDDD4444', '', '', ''],
  ];
  const sheet = {
    getLastColumn: () => header.length,
    getLastRow: () => rows.length + 1,
    getRange: (r, c, nr, nc) => ({
      getValues: () => (r === 1 ? [header] : rows.map((row) => row.slice(c - 1, c - 1 + nc))),
      setValue: () => {},
    }),
  };
  const t = X.loadTable_(sheet, header, [], 'Asia/Tokyo');
  assert.deepEqual(
    t.rows.map((r) => r.v['到着予定']),
    ['15:00', '20:30', '夕方', ''],
  );
  // 日時でない列はそのまま
  assert.equal(t.rows[1].v['メモ'], '20時ごろ');
});
