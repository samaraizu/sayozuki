import { describe, expect, it } from 'vitest';
import { bathTaxAmount, buildLedger, ledgerCsv } from '../src/lib/bathtax';
import { addDays, jstParts, withinWindow } from '../src/lib/time';
import { verifySquareSignature } from '../src/lib/webhook';

describe('入湯税', () => {
  it('課税対象人数 × 泊数 × 税率', () => {
    expect(bathTaxAmount(2, 1, 150)).toBe(300);
    expect(bathTaxAmount(3, 2, 150)).toBe(900);
    expect(bathTaxAmount(0, 2, 150)).toBe(0);
  });

  it('帳簿は1泊ごとに日別計上し、月をまたぐ連泊は月で切る', () => {
    const rows = buildLedger(
      [
        { room: '201', checkin_date: '2026-11-30', nights: 2, guests_taxable: 2, guests_exempt: 1 },
        { room: '202', checkin_date: '2026-12-01', nights: 1, guests_taxable: 1, guests_exempt: 0 }
      ],
      '2026-12',
      150
    );
    expect(rows).toEqual([{ date: '2026-12-01', rooms: 2, taxable: 3, exempt: 1, tax: 450 }]);
    const csv = ledgerCsv(rows);
    expect(csv).toContain('2026-12-01,2,3,1,450');
    expect(csv).toContain('合計,,3,1,450');
  });
});

describe('時刻（日本時間）', () => {
  it('UTCから日本時間の日付と分を出す', () => {
    const p = jstParts(new Date('2026-12-01T14:30:00Z')); // JST 23:30
    expect(p.date).toBe('2026-12-01');
    expect(p.minutes).toBe(23 * 60 + 30);
  });
  it('受付時間内か判定（日またぎ設定も）', () => {
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 11, 1, h - 9 < 0 ? h + 15 : h - 9, m));
    expect(withinWindow('06:00', '22:30', at(22, 29))).toBe(true);
    expect(withinWindow('06:00', '22:30', at(22, 30))).toBe(false);
    expect(withinWindow('06:00', '01:00', at(0, 30))).toBe(true);
    expect(withinWindow('06:00', '01:00', at(3, 0))).toBe(false);
  });
  it('日付の加算', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('Square webhook署名', () => {
  it('URL + 本文のHMAC-SHA256(Base64)で一致を判定', async () => {
    const key = 'test-key';
    const url = 'https://order.example.com/webhooks/square';
    const body = '{"type":"payment.updated"}';
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(url + body));
    const sig = btoa(String.fromCharCode(...new Uint8Array(mac)));
    expect(await verifySquareSignature(key, url, body, sig)).toBe(true);
    expect(await verifySquareSignature(key, url, body + ' ', sig)).toBe(false);
    expect(await verifySquareSignature(key, url, body, null)).toBe(false);
  });
});
