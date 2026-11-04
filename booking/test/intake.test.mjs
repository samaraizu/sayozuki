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

