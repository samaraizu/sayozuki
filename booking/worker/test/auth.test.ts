import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  allowedList,
  currentUser,
  finishLogin,
  isSyncCaller,
  makeSession,
  readSession,
  startLogin,
  verifyGoogleIdToken,
} from '../src/auth';
import worker from '../src/index';
import type { Env } from '../src/env';

const CLIENT = 'client-123.apps.googleusercontent.com';
const SECRET = 's'.repeat(40);
const now = 1_800_000_000;

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
  const certs = () => new Response(JSON.stringify({ keys: [{ kid, kty: 'RSA', n: jwk.n, e: jwk.e }] }));
  const sign = async (payload: Record<string, unknown>, k = kid) => {
    const head = enc({ alg: 'RS256', kid: k });
    const body = enc(payload);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(head + '.' + body));
    return head + '.' + body + '.' + b64url(sig);
  };
  return { certs, sign, fetcher: (async () => certs()) as unknown as typeof fetch };
}

const env = {
  GOOGLE_CLIENT_ID: CLIENT,
  GOOGLE_CLIENT_SECRET: 'cs',
  SESSION_SECRET: SECRET,
  ALLOWED_EMAILS: ' A@x.jp , b@x.jp',
} as Env;

const good = (over: Record<string, unknown> = {}) => ({
  aud: CLIENT, iss: 'https://accounts.google.com', exp: now + 60, iat: now, nonce: 'n1', email: 'A@x.jp', email_verified: true, ...over,
});

describe('Google の ID トークン', () => {
  it('正しいトークンならメール（小文字）を返す', async () => {
    const { fetcher, sign } = await setup();
    expect(await verifyGoogleIdToken(await sign(good()), { clientId: CLIENT, nonce: 'n1' }, fetcher, now)).toBe('a@x.jp');
    expect(await verifyGoogleIdToken(await sign(good({ iss: 'accounts.google.com' })), { clientId: CLIENT, nonce: 'n1' }, fetcher, now)).toBe('a@x.jp');
  });
  it('宛先・発行元・期限・nonce・メール未確認・署名が違えば通さない', async () => {
    const { fetcher, sign } = await setup();
    const v = async (p: Record<string, unknown>) => verifyGoogleIdToken(await sign(good(p)), { clientId: CLIENT, nonce: 'n1' }, fetcher, now);
    expect(await v({ aud: 'other' })).toBeNull();
    expect(await v({ iss: 'https://evil.example' })).toBeNull();
    expect(await v({ exp: now - 1 })).toBeNull();
    expect(await v({ nonce: 'n2' })).toBeNull();
    expect(await v({ email_verified: false })).toBeNull();
    const t = await sign(good());
    const forged = t.split('.').slice(0, 2).join('.') + '.' + enc({ x: 1 });
    expect(await verifyGoogleIdToken(forged, { clientId: CLIENT, nonce: 'n1' }, fetcher, now)).toBeNull();
    expect(await verifyGoogleIdToken(null, { clientId: CLIENT, nonce: 'n1' }, fetcher, now)).toBeNull();
    expect(await verifyGoogleIdToken(t, { clientId: '', nonce: 'n1' }, fetcher, now)).toBeNull();
  });
});

describe('ログイン状態のクッキー', () => {
  it('作ったものは読める。期限切れ・書き換え・別の鍵は読めない', async () => {
    const c = await makeSession('A@x.jp', env, now);
    expect(await readSession(c, env, now + 10)).toBe('a@x.jp');
    expect(await readSession(c, env, now + 31 * 86400)).toBeNull();
    const [body, sig] = c.split('.');
    const otherBody = enc({ e: 'evil@x.jp', x: now + 9999 });
    expect(await readSession(otherBody + '.' + sig, env, now)).toBeNull();
    expect(await readSession(body + '.' + sig + 'x', env, now)).toBeNull();
    expect(await readSession(c, { ...env, SESSION_SECRET: 't'.repeat(40) }, now)).toBeNull();
    expect(await readSession(c, { ...env, SESSION_SECRET: 'short' }, now)).toBeNull();
  });
  it('鍵が短いと作らない', async () => {
    await expect(makeSession('a@x.jp', { ...env, SESSION_SECRET: 'short' }, now)).rejects.toThrow();
  });
  it('許可リストから外れた人はクッキーが正しくても通さない', async () => {
    const req = async (email: string) =>
      new Request('https://w.example/api/board', { headers: { cookie: SESSION_COOKIE + '=' + (await makeSession(email, env, now)) } });
    expect(await currentUser(await req('b@x.jp'), env, now)).toBe('b@x.jp');
    expect(await currentUser(await req('c@x.jp'), env, now)).toBeNull();
    expect(await currentUser(new Request('https://w.example/api/board'), env, now)).toBeNull();
  });
  it('許可リストは小文字・空白なし', () => {
    expect(allowedList(env)).toEqual(['a@x.jp', 'b@x.jp']);
  });
});

describe('ログインの行き来', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('start は Google へ送り、state と nonce を控える', () => {
    const { location, cookie } = startLogin(env, 'https://w.example');
    const u = new URL(location);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('client_id')).toBe(CLIENT);
    expect(u.searchParams.get('redirect_uri')).toBe('https://w.example/api/auth/callback');
    expect(u.searchParams.get('scope')).toBe('openid email');
    const [state, nonce] = cookie.split('.');
    expect(u.searchParams.get('state')).toBe(state);
    expect(u.searchParams.get('nonce')).toBe(nonce);
  });

  it('callback：state が合わなければ Google に問い合わせもしない', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    expect(await finishLogin(env, 'https://w.example', { code: 'c', state: 'x' }, 'y.n1', fetcher, now)).toBeNull();
    expect(await finishLogin(env, 'https://w.example', { code: 'c', state: 'x' }, null, fetcher, now)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('Worker 全体：許可された人はクッキーをもらって / へ、許可外は /login?e=denied', async () => {
    const { certs, sign } = await setup();
    for (const [email, expectLoc, expectSession] of [['A@x.jp', '/', true], ['c@x.jp', '/login?e=denied', false]] as const) {
      const idToken = await sign(good({ email, exp: Date.now() / 1000 + 60, iat: Date.now() / 1000, nonce: 'n9' }));
      vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = String(input);
        if (u.startsWith('https://oauth2.googleapis.com/token')) {
          const body = new URLSearchParams(String(init?.body));
          expect(body.get('code')).toBe('code-1');
          expect(body.get('redirect_uri')).toBe('https://w.example/api/auth/callback');
          return new Response(JSON.stringify({ id_token: idToken }), { headers: { 'content-type': 'application/json' } });
        }
        if (u.startsWith('https://www.googleapis.com/oauth2/v3/certs')) return certs();
        throw new Error('想定外の通信 ' + u);
      });
      const res = await worker.fetch(
        new Request('https://w.example/api/auth/callback?code=code-1&state=st9', { headers: { cookie: OAUTH_COOKIE + '=st9.n9' } }),
        env,
      );
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(expectLoc);
      const setCookie = res.headers.get('set-cookie') || '';
      expect(setCookie.includes(SESSION_COOKIE + '=') && !setCookie.includes(SESSION_COOKIE + '=;')).toBe(expectSession);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Secure');
    }
  });

  it('ログインしていないと API は 401（画面がログインへ移る）', async () => {
    const res = await worker.fetch(new Request('https://w.example/api/board'), env);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, login: true });
  });

  it('設定が足りないと Google へ送らない', async () => {
    const res = await worker.fetch(new Request('https://w.example/api/auth/start'), { ...env, GOOGLE_CLIENT_SECRET: '' } as Env);
    expect(res.headers.get('location')).toBe('/login?e=config');
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
