import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, makeSession } from '../src/auth';
import worker from '../src/index';
import type { Env } from '../src/env';
import { isOrderPath } from '../src/order';

const SECRET = 's'.repeat(40);

function makeEnv() {
  const seen: Request[] = [];
  const env = {
    SESSION_SECRET: SECRET,
    ALLOWED_EMAILS: 'staff@example.com',
    ASSETS: { fetch: async () => new Response('asset') },
    ORDER: {
      fetch: async (r: Request) => {
        seen.push(r);
        if (r.url.endsWith('/staff')) return new Response(null, { status: 301, headers: { location: 'https://order.sayozuki.com/staff/' } });
        return new Response('order:' + new URL(r.url).pathname);
      },
    },
  } as unknown as Env;
  return { env, seen };
}

const loggedIn = async (env: Env) => `${SESSION_COOKIE}=${await makeSession('staff@example.com', env)}; other=1`;

describe('客室オーダーのスタッフ画面の中継', () => {
  it('中継するパス', () => {
    expect(isOrderPath('/staff/')).toBe(true);
    expect(isOrderPath('/staff/api/board')).toBe(true);
    expect(isOrderPath('/dishes.js')).toBe(true);
    expect(isOrderPath('/images/menu/sukiyaki.jpg')).toBe(true);
    expect(isOrderPath('/')).toBe(false);
    expect(isOrderPath('/staffing')).toBe(false);
    expect(isOrderPath('/api/board')).toBe(false);
  });

  it('ログインしていなければ画面はログインへ、APIは403（PINを消させない）', async () => {
    const { env, seen } = makeEnv();
    const page = await worker.fetch(new Request('https://booking.sayozuki.com/staff/'), env);
    expect(page.status).toBe(302);
    expect(page.headers.get('location')).toBe('/login');
    const api = await worker.fetch(new Request('https://booking.sayozuki.com/staff/api/board'), env);
    expect(api.status).toBe(403);
    expect(((await api.json()) as { error: string }).error).toBe('login');
    expect(seen).toHaveLength(0);
  });

  it('ログイン済みなら order.sayozuki.com として中継し、予約管理のクッキーは渡さない', async () => {
    const { env, seen } = makeEnv();
    const res = await worker.fetch(
      new Request('https://booking.sayozuki.com/staff/api/board?x=1', {
        headers: { cookie: await loggedIn(env), authorization: 'Bearer 1234', origin: 'https://booking.sayozuki.com' },
      }),
      env,
    );
    expect(await res.text()).toBe('order:/staff/api/board');
    expect(seen[0].url).toBe('https://order.sayozuki.com/staff/api/board?x=1');
    expect(seen[0].headers.get('cookie')).toBeNull();
    expect(seen[0].headers.get('authorization')).toBe('Bearer 1234');
    expect(seen[0].headers.get('origin')).toBe('https://order.sayozuki.com');
  });

  it('POST の本文もそのまま渡す', async () => {
    const { env, seen } = makeEnv();
    await worker.fetch(
      new Request('https://booking.sayozuki.com/staff/api/push/test', { method: 'POST', body: '{"a":1}', headers: { cookie: await loggedIn(env) } }),
      env,
    );
    expect(seen[0].method).toBe('POST');
    expect(await seen[0].text()).toBe('{"a":1}');
  });

  it('オーダー側の転送先は、この入口のパスに戻す', async () => {
    const { env } = makeEnv();
    const res = await worker.fetch(new Request('https://booking.sayozuki.com/staff', { headers: { cookie: await loggedIn(env) } }), env);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/staff/');
  });
});
