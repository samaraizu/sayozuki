import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('スマホ通知の署名（VAPID）', () => {
  // D1 の代わり：settings 表だけを持つ
  const store = new Map<string, string>();
  const DB = {
    prepare: (sql: string) => ({
      bind: (...a: string[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT OR IGNORE') && !store.has('vapid')) store.set('vapid', a[0]);
          return {};
        },
        first: async () => null
      }),
      first: async () => (store.has('vapid') ? { value: store.get('vapid')! } : null)
    })
  };
  const env = { DB } as never;
  const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

  it('公開鍵で検証できるES256のトークンを作る', async () => {
    const { vapidJwt } = await import('../src/lib/push');
    const { jwt, pub } = await vapidJwt(env, 'https://web.push.apple.com/abc');
    const [h, p, sig] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(unb64u(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    const payload = JSON.parse(new TextDecoder().decode(unb64u(p)));
    expect(payload.aud).toBe('https://web.push.apple.com');
    expect(payload.sub).toBe('mailto:info@sayozuki.com');
    expect(unb64u(pub).length).toBe(65);
    const key = await crypto.subtle.importKey('raw', unb64u(pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(sig), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });
});

describe('Webhookなしの支払い確認（Orders API）', () => {
  const env = { SQUARE_ENV: 'production', SQUARE_ACCESS_TOKEN: 'x' } as never;
  const stub = (order: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ order }))));
  afterEach(() => vi.unstubAllGlobals());

  it('COMPLETED、または支払いが付いて残りが0なら支払い済み', async () => {
    const { orderPaid } = await import('../src/square/checkout');
    stub({ state: 'COMPLETED' });
    expect(await orderPaid(env, 'o1')).toBe(true);
    stub({ state: 'OPEN', tenders: [{ id: 't' }], net_amount_due_money: { amount: 0, currency: 'JPY' } });
    expect(await orderPaid(env, 'o1')).toBe(true);
  });
  it('未払い・取消は支払い済みにしない', async () => {
    const { orderPaid } = await import('../src/square/checkout');
    stub({ state: 'OPEN', net_amount_due_money: { amount: 12000, currency: 'JPY' } });
    expect(await orderPaid(env, 'o1')).toBe(false);
    stub({ state: 'OPEN', tenders: [], net_amount_due_money: { amount: 0, currency: 'JPY' } });
    expect(await orderPaid(env, 'o1')).toBe(false);
    stub({ state: 'CANCELED', tenders: [{ id: 't' }], net_amount_due_money: { amount: 0, currency: 'JPY' } });
    expect(await orderPaid(env, 'o1')).toBe(false);
  });
});
