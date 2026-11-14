import { describe, expect, it } from 'vitest';
import { currentNight, occupiedRooms } from '../src/stay';
import type { Env } from '../src/env';

// 日本時間 = UTC+9
const jst = (iso: string, hour: number) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00+09:00`);

describe('いまお客様がいる部屋', () => {
  it('12時までは前の晩、12時からはその晩', () => {
    expect(currentNight(jst('2026-11-15', 0))).toBe('2026-11-14');
    expect(currentNight(jst('2026-11-15', 11))).toBe('2026-11-14');
    expect(currentNight(jst('2026-11-15', 12))).toBe('2026-11-15');
    expect(currentNight(jst('2026-11-15', 23))).toBe('2026-11-15');
  });

  it('その夜に泊まっている部屋だけを聞く', async () => {
    let bound: unknown[] = [];
    let sql = '';
    const env = {
      DB: {
        prepare: (q: string) => {
          sql = q;
          return {
            bind: (...a: unknown[]) => {
              bound = a;
              return { all: async () => ({ results: [{ room: '301' }, { room: '月山' }] }) };
            },
          };
        },
      },
    } as unknown as Env;
    const r = await occupiedRooms(env, jst('2026-11-15', 9));
    expect(r).toEqual({ night: '2026-11-14', rooms: ['301', '月山'] });
    expect(bound).toEqual(['2026-11-14']);
    expect(sql).toContain("status <> 'キャンセル'");
    expect(sql).toContain('check_in <= ?1 AND check_out > ?1');
  });
});
