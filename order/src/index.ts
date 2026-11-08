import type { Env } from './env';
import { HttpError, json } from './lib/util';
import { syncPendingPayments } from './lib/settle';
import { handleGuest } from './routes/guest';
import { handleStaff } from './routes/staff';
import { handleSquareWebhook } from './routes/webhook';

export { OrderDesk } from './desk';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/webhooks/square' && req.method === 'POST') return await handleSquareWebhook(req, env, url, ctx);
      if (url.pathname.startsWith('/staff/api/')) return await handleStaff(req, env, url, ctx);
      if (url.pathname.startsWith('/api/')) return await handleGuest(req, env, url, ctx);
      // 商品ごとの紹介ページ /menu/<slug>。中身は同じ menu.html で、slug を見て描き分ける
      if (url.pathname.startsWith('/menu/')) return env.ASSETS.fetch(new Request(new URL('/menu', url), req));
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, detail: e.message !== e.code ? e.message : undefined }, e.status);
      console.error(e);
      return json({ error: 'internal' }, 500);
    }
  },

  // Webhookが届かなくても、お支払い待ちの精算を毎分Squareに確かめる
  async scheduled(_ctl: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncPendingPayments(env, { force: true }));
  }
} satisfies ExportedHandler<Env>;
