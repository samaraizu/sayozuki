/**
 * 小夜月 予約管理（Cloudflare Workers + D1）
 *
 * 画面（public/index.html・login.html）は静的に配る。中身のデータは /api/* からしか出ない。
 * /api/* はログイン（Googleでログイン、src/auth.ts）と ALLOWED_EMAILS の両方で確かめる。
 * /api/sync/* だけは取り込みGASからの呼び出しで、SYNC_TOKEN で確かめる。
 */
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_DAYS,
  allowedList,
  cookieHeader,
  currentUser,
  finishLogin,
  isSyncCaller,
  loginConfigured,
  makeSession,
  readCookie,
  startLogin,
} from './auth';
import { createBooking, getBoard, pendingForSheet, syncFromSheet, type ManualForm, type SyncPayload } from './db';
import { UserError, json, type Env } from './env';

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
}

async function handleAuth(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === '/api/auth/start') {
    if (!loginConfigured(env)) return redirect('/login?e=config');
    const { location, cookie } = startLogin(env, url.origin);
    return redirect(location, [cookieHeader(OAUTH_COOKIE, cookie, 600)]);
  }

  if (path === '/api/auth/callback') {
    const clearOauth = cookieHeader(OAUTH_COOKIE, '', 0);
    if (url.searchParams.get('error')) return redirect('/login?e=cancel', [clearOauth]);
    if (!loginConfigured(env)) return redirect('/login?e=config', [clearOauth]);
    const email = await finishLogin(
      env,
      url.origin,
      { code: url.searchParams.get('code'), state: url.searchParams.get('state') },
      readCookie(req, OAUTH_COOKIE),
    );
    if (!email) return redirect('/login?e=failed', [clearOauth]);
    if (!allowedList(env).includes(email)) {
      console.log('許可リストにないアカウントでログインしようとした');
      return redirect('/login?e=denied', [clearOauth, cookieHeader(SESSION_COOKIE, '', 0)]);
    }
    const session = await makeSession(email, env);
    return redirect('/', [clearOauth, cookieHeader(SESSION_COOKIE, session, SESSION_DAYS * 86400)]);
  }

  if (path === '/api/auth/logout') {
    return redirect('/login?e=out', [cookieHeader(SESSION_COOKIE, '', 0)]);
  }

  return json({ ok: false, message: 'not found' }, 404);
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.startsWith('/api/sync/')) {
    if (!(await isSyncCaller(req, env))) return json({ ok: false, message: 'unauthorized' }, 401);
    if (path === '/api/sync/pending' && req.method === 'GET') return json(await pendingForSheet(env));
    if (path === '/api/sync/sheet' && req.method === 'POST') return json(await syncFromSheet(env, (await req.json()) as SyncPayload));
    return json({ ok: false, message: 'not found' }, 404);
  }

  if (path.startsWith('/api/auth/')) return handleAuth(req, env, url);

  if (path.startsWith('/api/')) {
    const email = await currentUser(req, env);
    if (!email) {
      // 画面側（build.mjs の google.script.run 代わり）が 401 を見てログイン画面へ移る
      const res = json({ ok: false, login: true, message: 'ログインして' }, 401);
      if (readCookie(req, SESSION_COOKIE)) res.headers.append('set-cookie', cookieHeader(SESSION_COOKIE, '', 0));
      return res;
    }
    if (path === '/api/board' && req.method === 'GET') return json(await getBoard(env, email));
    if (path === '/api/bookings' && req.method === 'POST') {
      // 別サイトからの書き込みを弾く（クッキーは SameSite=Lax だが念のため）
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return json({ ok: false, message: 'bad origin' }, 403);
      return json(await createBooking(env, email, (await req.json()) as ManualForm));
    }
    return json({ ok: false, message: 'not found' }, 404);
  }

  return env.ASSETS.fetch(req);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handle(req, env);
    } catch (e) {
      if (e instanceof UserError) return json({ ok: false, message: e.message });
      console.error(e instanceof Error ? e.stack : e);
      return json({ ok: false, message: 'うまくいかなかった。時間をおいてもう一度試して' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
