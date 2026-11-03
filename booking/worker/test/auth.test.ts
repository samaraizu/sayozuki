import { describe, expect, it } from 'vitest';
import { allowedList, isSyncCaller, verifyAccess } from '../src/auth';
import type { Env } from '../src/env';

const TEAM = 'https://example.cloudflareaccess.com';
const AUD = 'aud-123';

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function setup() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  const kid = 'k' + Math.random().toString(36).slice(2);
  const fetcher = (async () => new Response(JSON.stringify({ keys: [{ kid, kty: 'RSA', n: jwk.n, e: jwk.e }] }))) as unknown as typeof fetch;
  const sign = async (payload: Record<string, unknown>, k = kid) => {
    const head = enc({ alg: 'RS256', kid: k });
    const body = enc(payload);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(head + '.' + body));
    return head + '.' + body + '.' + b64url(sig);
  };
  return { fetcher, sign };
}

const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALLOWED_EMAILS: ' A@x.jp , b@x.jp' } as Env;
const now = 1_800_000_000;

describe('Cloudflare Access のトークン', () => {
  it('正しいトークンならメールを返す', async () => {
    const { fetcher, sign } = await setup();
    const t = await sign({ aud: [AUD], exp: now + 60, iss: TEAM, email: 'A@x.jp' });
    expect(await verifyAccess(t, env, fetcher, now)).toBe('a@x.jp');
  });
  it('宛先・期限・発行元・署名が違えば通さない', async () => {
    const { fetcher, sign } = await setup();
    expect(await verifyAccess(await sign({ aud: ['other'], exp: now + 60, email: 'a@x.jp' }), env, fetcher, now)).toBeNull();
    expect(await verifyAccess(await sign({ aud: AUD, exp: now - 1, email: 'a@x.jp' }), env, fetcher, now)).toBeNull();
    expect(await verifyAccess(await sign({ aud: AUD, exp: now + 60, iss: 'https://evil', email: 'a@x.jp' }), env, fetcher, now)).toBeNull();
    const t = await sign({ aud: AUD, exp: now + 60, email: 'a@x.jp' });
    const forged = t.split('.').slice(0, 2).join('.') + '.' + enc({ x: 1 });
    expect(await verifyAccess(forged, env, fetcher, now)).toBeNull();
    expect(await verifyAccess(null, env, fetcher, now)).toBeNull();
    expect(await verifyAccess(t, { ...env, ACCESS_AUD: '' }, fetcher, now)).toBeNull();
  });
  it('許可リストは小文字・空白なし', () => {
    expect(allowedList(env)).toEqual(['a@x.jp', 'b@x.jp']);
  });
});

describe('同期の合言葉', () => {
  const token = 'x'.repeat(40);
  const req = (h?: string) => new Request('https://w/api/sync/pending', { headers: h ? { authorization: h } : {} });
  it('一致したときだけ通す', async () => {
    expect(await isSyncCaller(req('Bearer ' + token), { SYNC_TOKEN: token } as Env)).toBe(true);
    expect(await isSyncCaller(req('Bearer ' + token + 'y'), { SYNC_TOKEN: token } as Env)).toBe(false);
    expect(await isSyncCaller(req(), { SYNC_TOKEN: token } as Env)).toBe(false);
  });
  it('合言葉が短い・未設定なら誰も通さない', async () => {
    expect(await isSyncCaller(req('Bearer short'), { SYNC_TOKEN: 'short' } as Env)).toBe(false);
    expect(await isSyncCaller(req('Bearer '), {} as Env)).toBe(false);
  });
});
