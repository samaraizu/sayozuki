import { describe, expect, it } from 'vitest';
import { addDays, jstParts, withinWindow } from '../src/lib/time';
import { verifySquareSignature } from '../src/lib/webhook';

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
