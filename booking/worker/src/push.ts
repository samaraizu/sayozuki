/**
 * スマホへの Web プッシュ通知（客室オーダーのスタッフ通知と同じやり方）。
 * 本文は暗号化が要るので送らず「何か届いた」合図だけを送り、スマホ側（public/sw.js）が
 * /api/push/latest から最新の一文を取りにいって表示する（ログイン中のクッキーで取る）。
 * 送信元を名乗る鍵（VAPID）は初回に自動で作って D1 の meta に保存する。シークレットの登録は要らない。
 * メール通知はこれまでどおり（取り込みGAS・HP予約の確認メール）。こちらは同じ場面でスマホにも出すため。
 */
import { allowedList } from './auth';
import type { Env } from './env';

const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const enc = (o: unknown) => b64u(new TextEncoder().encode(JSON.stringify(o)));

interface Vapid { pub: string; key: CryptoKey }
let cached: Vapid | null = null;

export async function vapid(env: Env): Promise<Vapid> {
  if (cached) return cached;
  const read = () => env.DB.prepare("SELECT value FROM meta WHERE key = 'vapid'").first<{ value: string }>();
  let row = await read();
  if (!row) {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const raw = (await crypto.subtle.exportKey('raw', kp.publicKey)) as ArrayBuffer;
    // 同時に作られても、先に入ったほうを使う
    await env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('vapid', ?)").bind(JSON.stringify({ jwk, pub: b64u(raw) })).run();
    row = await read();
  }
  const v = JSON.parse(row!.value) as { jwk: JsonWebKey; pub: string };
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  cached = { pub: v.pub, key };
  return cached;
}

/** RFC 8292 の VAPID トークン（ES256 の JWT） */
async function vapidJwt(env: Env, endpoint: string) {
  const v = await vapid(env);
  const data = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:info@sayozuki.com',
  })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.key, new TextEncoder().encode(data));
  return { jwt: `${data}.${b64u(sig)}`, pub: v.pub };
}

// ブラウザのプッシュ配信元だけに送る（よそのURLを登録されても送らない）
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.apple\.com$/, /\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.mozaws\.net$/];
export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export async function subscribe(env: Env, email: string, endpoint: string) {
  if (!isPushEndpoint(endpoint)) return { ok: false, message: 'この端末の通知先は使えない' };
  await env.DB.prepare(
    'INSERT INTO push_subs (endpoint, email) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET email = excluded.email',
  ).bind(endpoint, email).run();
  return { ok: true };
}

export async function unsubscribe(env: Env, endpoint: string) {
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
  return { ok: true };
}

export async function latest(env: Env) {
  const row = await env.DB.prepare('SELECT title, body, link FROM push_log ORDER BY id DESC LIMIT 1').first<{ title: string; body: string; link: string }>();
  return { ok: true, ...(row || { title: '小夜月 予約', body: '', link: '/' }) };
}

/** 通知に出す文を残して、登録済みの全端末（onlyEmail があればその人の端末だけ）に合図を送る。失敗しても呼び出し元は止めない */
export async function notify(env: Env, title: string, body: string, link = '/', onlyEmail?: string) {
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO push_log (title, body, link) VALUES (?, ?, ?)').bind(title.slice(0, 80), body.slice(0, 500), link),
      env.DB.prepare('DELETE FROM push_log WHERE id <= (SELECT MAX(id) FROM push_log) - 200'),
    ]);
    const allowed = new Set(allowedList(env));
    const { results } = await env.DB.prepare('SELECT endpoint, email FROM push_subs').all<{ endpoint: string; email: string }>();
    await Promise.all(
      results
        .filter((s) => allowed.has(s.email) && (!onlyEmail || s.email === onlyEmail))
        .map(async ({ endpoint }) => {
          try {
            const { jwt, pub } = await vapidJwt(env, endpoint);
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { authorization: `vapid t=${jwt}, k=${pub}`, ttl: '86400', urgency: 'high', 'content-length': '0' },
            });
            // 解除された端末は宛先から外す
            if (res.status === 404 || res.status === 410) await unsubscribe(env, endpoint);
            else if (!res.ok) console.error('push failed', res.status, await res.text().catch(() => ''));
          } catch (e) {
            console.error('push error', e);
          }
        }),
    );
  } catch (e) {
    console.error('notify failed', e);
  }
}

/** 取り込みGASが送ってくる通知メールの文（1件ずつ。1行目が見出し）をまとめて1回の通知にする */
export function summarizeNotes(notes: unknown): { title: string; body: string } | null {
  const lines = (Array.isArray(notes) ? notes : [])
    .map((n) => String(n ?? '').split('\n')[0].trim())
    .filter(Boolean);
  if (!lines.length) return null;
  if (lines.length === 1) return { title: '小夜月 予約', body: lines[0] };
  return { title: `小夜月 予約（${lines.length}件）`, body: lines.join('\n') };
}
