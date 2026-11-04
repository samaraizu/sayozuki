import { describe, expect, it } from 'vitest';
import { checkInput, occupancy, type CheckoutInput } from '../src/hp';
import { isPaidOrder } from '../src/square';

const base: CheckoutInput = {
  room: '蔵王', checkIn: '2026-12-19', checkOut: '2026-12-21', guests: 3,
  name: 'テスト', email: 't@example.com', tel: '', arrival: '16:00', meals: '朝食', memo: '', lang: 'ja',
  lines: [{ name: '宿泊 蔵王', quantity: 2, unitAmount: 20250 }, { name: '朝食', quantity: 6, unitAmount: 1000 }],
  amount: 46500, returnUrl: 'https://sayozuki.com/reserve/done',
  mail: { guestSubject: 's', guestBody: 'b', innSubject: 's', innBody: 'b' },
};

describe('checkInput', () => {
  it('正しい入力は通す', () => expect(checkInput(base, '2026-11-04')).toBeNull());
  it('明細の合計と額が合わなければ断る', () => expect(checkInput({ ...base, amount: 46000 }, '2026-11-04')).toBe('amount'));
  it('過ぎた日・逆の日付・31泊は断る', () => {
    expect(checkInput({ ...base, checkIn: '2026-11-03', checkOut: '2026-11-05' }, '2026-11-04')).toBe('past');
    expect(checkInput({ ...base, checkOut: '2026-12-19' }, '2026-11-04')).toBe('dates');
    expect(checkInput({ ...base, checkOut: '2027-01-19' }, '2026-11-04')).toBe('dates');
  });
  it('メール・名前・人数・戻り先がおかしければ断る', () => {
    expect(checkInput({ ...base, email: 'x' }, '2026-11-04')).toBe('email');
    expect(checkInput({ ...base, name: ' ' }, '2026-11-04')).toBe('name');
    expect(checkInput({ ...base, guests: 0 }, '2026-11-04')).toBe('guests');
    expect(checkInput({ ...base, returnUrl: 'javascript:alert(1)' }, '2026-11-04')).toBe('returnUrl');
    expect(checkInput({ ...base, lines: [{ name: 'x', quantity: 1.5, unitAmount: 100 }], amount: 150 }, '2026-11-04')).toBe('lines');
  });
});

describe('occupancy', () => {
  it('部屋ごとに埋まっている夜を返す（範囲の外は切る）', () => {
    const r = occupancy(
      [{ name: '蔵王', capacity: 4, state: '販売可' }, { name: '月山', capacity: 4, state: '販売可' }],
      [
        { room: '蔵王', check_in: '2026-11-02', check_out: '2026-11-06' },
        { room: '月山', check_in: '2026-11-08', check_out: '2026-11-12' },
        { room: '302', check_in: '2026-11-05', check_out: '2026-11-06' },
      ],
      '2026-11-04',
      '2026-11-10',
    );
    expect(r).toEqual([
      { name: '蔵王', capacity: 4, state: '販売可', booked: ['2026-11-04', '2026-11-05'] },
      { name: '月山', capacity: 4, state: '販売可', booked: ['2026-11-08', '2026-11-09'] },
    ]);
  });
});

describe('isPaidOrder', () => {
  it('COMPLETED、または支払いがあって残額0なら済み。取消は済みにしない', () => {
    expect(isPaidOrder({ state: 'COMPLETED' })).toBe(true);
    expect(isPaidOrder({ state: 'OPEN', tenders: [{}], net_amount_due_money: { amount: 0 } })).toBe(true);
    expect(isPaidOrder({ state: 'OPEN' })).toBe(false);
    expect(isPaidOrder({ state: 'CANCELED', tenders: [{}], net_amount_due_money: { amount: 0 } })).toBe(false);
  });
});
