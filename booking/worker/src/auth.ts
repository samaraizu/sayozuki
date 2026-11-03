// Cloudflare Access のログインを確かめる。
// Access を通ってきたリクエストには Cf-Access-Jwt-Assertion（署名付きのトークン）が付く。
// 署名・宛先（AUD）・期限を確かめてからメールを取り出し、ALLOWED_EMAILS とも突き合わせる（二重の鍵）。
import type { Env } from './env';

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }
let certCache: { url: string; at: number; keys: Jwk[] } | null = null;

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodePart<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
}

async function getKeys(team: string, fetcher: typeof fetch, force = false): Promise<Jwk[]> {
  const url = team.replace(/\/+$/, '') + '/cdn-cgi/access/certs';
  if (!force && certCache && certCache.url === url && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const res = await fetcher(url);
  if (!res.ok) throw new Error('Access の公開鍵が取れない（' + res.status + '）');
  const body = (await res.json()) as { keys: Jwk[] };
  certCache = { url, at: Date.now(), keys: body.keys || [] };
  return certCache.keys;
}

export function allowedList(env: Env): string[] {
  return String(env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** ログインしている人のメール。確かめられなければ null */
export async function verifyAccess(token: string | null, env: Env, fetcher: typeof fetch = fetch, nowSec = Date.now() / 1000): Promise<string | null> {
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header: { kid?: string; alg?: string };
  let payload: { aud?: string | string[]; exp?: number; nbf?: number; iss?: string; email?: string };
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  let keys = await getKeys(env.ACCESS_TEAM_DOMAIN, fetcher);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getKeys(env.ACCESS_TEAM_DOMAIN, fetcher, true); // 鍵の入れ替え直後
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
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (!payload.exp || payload.exp < nowSec) return null;
  if (payload.nbf && payload.nbf > nowSec + 60) return null;
  if (payload.iss && payload.iss.replace(/\/+$/, '') !== env.ACCESS_TEAM_DOMAIN.replace(/\/+$/, '')) return null;
  return payload.email ? payload.email.trim().toLowerCase() : null;
}

/** 画面のAPIを使ってよい人のメール。だめなら null */
export async function currentUser(req: Request, env: Env): Promise<string | null> {
  let email: string | null = null;
  const host = new URL(req.url).hostname;
  if (env.DEV_EMAIL && (host === 'localhost' || host === '127.0.0.1')) {
    email = env.DEV_EMAIL.trim().toLowerCase();
  } else {
    email = await verifyAccess(req.headers.get('cf-access-jwt-assertion'), env);
  }
  if (!email) return null;
  return allowedList(env).includes(email) ? email : null;
}

/** 取り込みGASからの同期。Authorization: Bearer <SYNC_TOKEN> */
export async function isSyncCaller(req: Request, env: Env): Promise<boolean> {
  const want = env.SYNC_TOKEN || '';
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (want.length < 32 || !got) return false;
  const a = new TextEncoder().encode(want);
  const b = new TextEncoder().encode(got);
  if (a.length !== b.length) return false;
  // 長さが同じときは時間差の出ない比較
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(a, b) : a.every((x, i) => x === b[i]);
}
