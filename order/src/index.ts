import type { Env } from './env';
import { HttpError, json } from './lib/util';
import { handleGuest } from './routes/guest';
import { handleStaff } from './routes/staff';
import { handleSquareWebhook } from './routes/webhook';

export { OrderDesk } from './desk';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/webhooks/square' && req.method === 'POST') return await handleSquareWebhook(req, env, url);
      if (url.pathname.startsWith('/staff/api/')) return await handleStaff(req, env, url);
      if (url.pathname.startsWith('/api/')) return await handleGuest(req, env, url);
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, detail: e.message !== e.code ? e.message : undefined }, e.status);
      console.error(e);
      return json({ error: 'internal' }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
