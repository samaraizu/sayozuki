/**
 * 小夜月 予約管理（Cloudflare Workers + D1）
 *
 * 画面（public/index.html）は Cloudflare Access の後ろで配り、API は Access のトークンと
 * ALLOWED_EMAILS の両方で確かめる。/api/sync/* だけは取り込みGASからの呼び出しで、SYNC_TOKEN で確かめる
 * （Access 側でこのパスだけ Bypass にしておく）。
 */
import { currentUser, isSyncCaller } from './auth';
import { createBooking, getBoard, pendingForSheet, syncFromSheet, type ManualForm, type SyncPayload } from './db';
import { UserError, json, type Env } from './env';

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.startsWith('/api/sync/')) {
    if (!(await isSyncCaller(req, env))) return json({ ok: false, message: 'unauthorized' }, 401);
    if (path === '/api/sync/pending' && req.method === 'GET') return json(await pendingForSheet(env));
    if (path === '/api/sync/sheet' && req.method === 'POST') return json(await syncFromSheet(env, (await req.json()) as SyncPayload));
    return json({ ok: false, message: 'not found' }, 404);
  }

  if (path.startsWith('/api/')) {
    const email = await currentUser(req, env);
    if (!email) return json({ ok: false, message: 'このアカウントでは使えない' }, 403);
    if (path === '/api/board' && req.method === 'GET') return json(await getBoard(env, email));
    if (path === '/api/bookings' && req.method === 'POST') {
      // 別サイトからの書き込みを弾く（Access のクッキーが付いてしまうため）
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
