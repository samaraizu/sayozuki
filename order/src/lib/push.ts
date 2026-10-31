import type { Env } from '../env';
import { nowIso } from './time';

/**
 * スタッフのスマホへの Web プッシュ通知。
 * 中身（本文）は暗号化が要るので送らず、「何か届いた」合図だけを送る。
 * 受け取ったスマホ側（/staff/sw.js）が /staff/api/push/latest から最新の一文を取りにいって表示する。
 * 送信元を名乗る鍵（VAPID）は初回に自動で作って D1 に保存する（シークレットの登録は不要）。
 */

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));

interface Vapid {
  pub: string;
  key: CryptoKey;
}

let cached: Vapid | null = null;

export async function vapid(env: Env): Promise<Vapid> {
  if (cached) return cached;
  let row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first<{ value: string }>();
  if (!row) {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const raw = (await crypto.subtle.exportKey('raw', kp.publicKey)) as ArrayBuffer;
    // 同時に作られても、先に入ったほうを使う
    await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('vapid', ?)").bind(JSON.stringify({ jwk, pub: b64u(raw) })).run();
    row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first<{ value: string }>();
  }
  const v = JSON.parse(row!.value) as { jwk: JsonWebKey; pub: string };
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  cached = { pub: v.pub, key };
  return cached;
}

/** RFC 8292 の VAPID トークン（ES256 の JWT） */
export async function vapidJwt(env: Env, endpoint: string) {
  const v = await vapid(env);
  const data = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:info@sayozuki.com'
  })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.key, new TextEncoder().encode(data));
  return { jwt: `${data}.${b64u(sig)}`, pub: v.pub };
}

/** 通知に出す一文を保存して、登録済みの全スマホに合図を送る */
export async function pushStaff(env: Env, text: string, link = '/staff/') {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('latest', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(JSON.stringify({ text, link, at: nowIso() }))
    .run();
  const subs = await env.DB.prepare('SELECT endpoint FROM push_subs').all<{ endpoint: string }>();
  await Promise.all(
    (subs.results ?? []).map(async ({ endpoint }) => {
      try {
        const { jwt, pub } = await vapidJwt(env, endpoint);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { authorization: `vapid t=${jwt}, k=${pub}`, ttl: '86400', urgency: 'high', 'content-length': '0' }
        });
        // 解除されたスマホは宛先から外す
        if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
        else if (!res.ok) console.error('push failed', res.status, await res.text().catch(() => ''));
      } catch (e) {
        console.error('push error', e);
      }
    })
  );
}
