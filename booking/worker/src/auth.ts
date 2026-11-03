// ログインは「Googleでログイン」（OpenID Connect の認可コードフロー）。
//   /api/auth/start    … Google のログイン画面へ送る（state と nonce をクッキーに控える）
//   /api/auth/callback … Google から戻ってきたら、コードを ID トークンに替えて確かめ、
//                         ALLOWED_EMAILS に入っている人だけログイン状態のクッキーを渡す
// ポップアップを使わない（ホーム画面に追加したアプリの中でも動くように、ページの移動だけで完結させる）。
// ログイン状態のクッキーは SESSION_SECRET で署名する。毎回 ALLOWED_EMAILS と突き合わせ直すので、
// 許可リストから消せばその人はすぐ入れなくなる。
import type { Env } from './env';

export const SESSION_COOKIE = '__Host-sz_session';
export const OAUTH_COOKIE = '__Host-sz_oauth';
export const SESSION_DAYS = 30;
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }
let certCache: { at: number; keys: Jwk[] } | null = null;

// ---------- 小道具 ----------

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePart<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
}

export function randomToken(bytes = 24): string {
  return bytesToB64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean };
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function cookieHeader(name: string, value: string, maxAgeSec: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`;
}

export function allowedList(env: Env): string[] {
  return String(env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function loginConfigured(env: Env): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && String(env.SESSION_SECRET || '').length >= 32);
}

// ---------- ログイン状態のクッキー（メール＋期限を SESSION_SECRET で署名） ----------

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

export async function makeSession(email: string, env: Env, nowSec = Date.now() / 1000): Promise<string> {
  const secret = String(env.SESSION_SECRET || '');
  if (secret.length < 32) throw new Error('SESSION_SECRET が短い（32文字以上）');
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify({ e: email.trim().toLowerCase(), x: Math.floor(nowSec + SESSION_DAYS * 86400) })));
  return body + '.' + bytesToB64url(await hmac(secret, body));
}

/** 署名と期限が正しければメール。だめなら null（許可リストはここでは見ない） */
export async function readSession(value: string | null, env: Env, nowSec = Date.now() / 1000): Promise<string | null> {
  const secret = String(env.SESSION_SECRET || '');
  if (!value || secret.length < 32) return null;
  const [body, sig, extra] = value.split('.');
  if (!body || !sig || extra !== undefined) return null;
  let given: Uint8Array;
  try {
    given = b64urlToBytes(sig);
  } catch {
    return null;
  }
  if (!sameBytes(given, await hmac(secret, body))) return null;
  let data: { e?: string; x?: number };
  try {
    data = decodePart(body);
  } catch {
    return null;
  }
  if (!data.e || !data.x || data.x < nowSec) return null;
  return data.e;
}

/** 画面のAPIを使ってよい人のメール。だめなら null */
export async function currentUser(req: Request, env: Env, nowSec = Date.now() / 1000): Promise<string | null> {
  let email: string | null = null;
  const host = new URL(req.url).hostname;
  if (env.DEV_EMAIL && (host === 'localhost' || host === '127.0.0.1')) {
    email = env.DEV_EMAIL.trim().toLowerCase();
  } else {
    email = await readSession(readCookie(req, SESSION_COOKIE), env, nowSec);
  }
  if (!email) return null;
  return allowedList(env).includes(email) ? email : null;
}

// ---------- Google の ID トークン ----------

async function googleKeys(fetcher: typeof fetch, force = false): Promise<Jwk[]> {
  if (!force && certCache && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const res = await fetcher(GOOGLE_CERTS);
  if (!res.ok) throw new Error('Google の公開鍵が取れない（' + res.status + '）');
  const body = (await res.json()) as { keys: Jwk[] };
  certCache = { at: Date.now(), keys: body.keys || [] };
  return certCache.keys;
}

/** 署名・宛先・発行元・期限・nonce・メール確認済みを確かめてメールを返す。だめなら null */
export async function verifyGoogleIdToken(
  token: string | null | undefined,
  opts: { clientId: string; nonce: string },
  fetcher: typeof fetch = fetch,
  nowSec = Date.now() / 1000,
): Promise<string | null> {
  if (!token || !opts.clientId || !opts.nonce) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header: { kid?: string; alg?: string };
  let payload: { aud?: string | string[]; exp?: number; iat?: number; iss?: string; email?: string; email_verified?: boolean | string; nonce?: string };
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  let keys = await googleKeys(fetcher);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await googleKeys(fetcher, true); // 鍵の入れ替え直後
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]),
  );
  if (!ok) return null;

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(opts.clientId)) return null;
  if (!payload.iss || !GOOGLE_ISSUERS.includes(payload.iss)) return null;
  if (!payload.exp || payload.exp < nowSec) return null;
  if (payload.iat && payload.iat > nowSec + 300) return null;
  if (payload.nonce !== opts.nonce) return null;
  if (payload.email_verified !== true && payload.email_verified !== 'true') return null;
  return payload.email ? payload.email.trim().toLowerCase() : null;
}

// ---------- ログインの行き来 ----------

/** Google のログイン画面のURLと、控えておくクッキーの中身（state.nonce） */
export function startLogin(env: Env, origin: string): { location: string; cookie: string } {
  const state = randomToken();
  const nonce = randomToken();
  const q = new URLSearchParams({
    client_id: String(env.GOOGLE_CLIENT_ID),
    redirect_uri: origin + '/api/auth/callback',
    response_type: 'code',
    scope: 'openid email',
    state,
    nonce,
    prompt: 'select_account', // Google のアカウントが複数あるとき選べるように
  });
  return { location: GOOGLE_AUTH + '?' + q.toString(), cookie: state + '.' + nonce };
}

/** Google から戻ってきたコードを確かめて、ログインした人のメールを返す（許可リストはここでは見ない） */
export async function finishLogin(
  env: Env,
  origin: string,
  params: { code: string | null; state: string | null },
  saved: string | null,
  fetcher: typeof fetch = fetch,
  nowSec = Date.now() / 1000,
): Promise<string | null> {
  if (!params.code || !params.state || !saved) return null;
  const [state, nonce] = saved.split('.');
  if (!state || !nonce) return null;
  if (!sameBytes(new TextEncoder().encode(params.state), new TextEncoder().encode(state))) return null;

  const res = await fetcher(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: String(env.GOOGLE_CLIENT_ID),
      client_secret: String(env.GOOGLE_CLIENT_SECRET),
      redirect_uri: origin + '/api/auth/callback',
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { id_token?: string };
  return verifyGoogleIdToken(body.id_token, { clientId: String(env.GOOGLE_CLIENT_ID), nonce }, fetcher, nowSec);
}

// ---------- 取り込みGASからの同期。Authorization: Bearer <SYNC_TOKEN> ----------

export async function isSyncCaller(req: Request, env: Env): Promise<boolean> {
  const want = env.SYNC_TOKEN || '';
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (want.length < 32 || !got) return false;
  return sameBytes(new TextEncoder().encode(want), new TextEncoder().encode(got));
}
