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
import { WorkerEntrypoint } from 'cloudflare:workers';
import { createBooking, getBoard, pendingForSheet, syncFromSheet, type ManualForm, type SyncPayload } from './db';
import { UserError, json, type Env } from './env';
import { calendar, checkoutStatus, startCheckout, sweep, type CheckoutInput } from './hp';
import { addInquiry, closeInquiry, type InquiryInput } from './inquiries';
import { cancelBooking, type CancelForm } from './cancel';
import { setMeals, type MealForm } from './meals';
import { latest, notify, subscribe, unsubscribe, vapid } from './push';
import { isOrderPath, proxyOrder } from './order';
import { occupiedRooms } from './stay';

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
    // スマホへの通知（public/push.js・sw.js）
    if (path === '/api/push/key' && req.method === 'GET') return json({ ok: true, key: (await vapid(env)).pub });
    if (path === '/api/push/latest' && req.method === 'GET') return json(await latest(env));
    if (path.startsWith('/api/push/') && req.method === 'POST') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return json({ ok: false, message: 'bad origin' }, 403);
      const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
      if (path === '/api/push/subscribe') return json(await subscribe(env, email, String(body.endpoint || '')));
      if (path === '/api/push/unsubscribe') return json(await unsubscribe(env, String(body.endpoint || '')));
      if (path === '/api/push/test') {
        await notify(env, '小夜月 予約', 'テスト通知。新しい予約・要確認・HP予約・問い合わせがこの形で届きます', '/', email);
        return json({ ok: true });
      }
    }
    if (path === '/api/bookings' && req.method === 'POST') {
      // 別サイトからの書き込みを弾く（クッキーは SameSite=Lax だが念のため）
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return json({ ok: false, message: 'bad origin' }, 403);
      return json(await createBooking(env, email, (await req.json()) as ManualForm));
    }
    if (path === '/api/bookings/cancel' && req.method === 'POST') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return json({ ok: false, message: 'bad origin' }, 403);
      return json(await cancelBooking(env, email, (await req.json()) as CancelForm));
    }
    if (path === '/api/bookings/meals' && req.method === 'POST') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return json({ ok: false, message: 'bad origin' }, 403);
      return json(await setMeals(env, email, (await req.json()) as MealForm));
    }
    if (path === '/api/inquiries/close' && req.method === 'POST') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return json({ ok: false, message: 'bad origin' }, 403);
      return json(await closeInquiry(env, email, (await req.json()) as { id?: string; reason?: string }));
    }
    return json({ ok: false, message: 'not found' }, 404);
  }

  // 客室オーダーのスタッフ画面（src/order.ts）
  if (isOrderPath(path)) return proxyOrder(req, env, url);

  return env.ASSETS.fetch(req);
}

/**
 * 客室オーダー（Worker「sayozuki-order」）専用の入口。サービスバインディング（entrypoint: "OrderApi"）でしか呼べない。
 * いまお客様がいる部屋の名前だけを返す（名前・人数などは出さない）。
 */
export class OrderApi extends WorkerEntrypoint<Env> {
  async occupied() {
    return occupiedRooms(this.env);
  }
}

/**
 * HP（Worker「sayozuki」）専用の入口。サービスバインディング（entrypoint: "HpApi"）でしか呼べず、
 * インターネットからは届かない。空室・予約と事前決済の開始・完了画面の確認・お問い合わせの受け取りだけ。
 */
export class HpApi extends WorkerEntrypoint<Env> {
  async calendar(days?: number) {
    return calendar(this.env, days);
  }
  async startCheckout(input: CheckoutInput) {
    return startCheckout(this.env, input);
  }
  async checkoutStatus(no: string, key: string) {
    return checkoutStatus(this.env, no, key);
  }
  async addInquiry(input: InquiryInput) {
    return addInquiry(this.env, input);
  }
}

export default {
  // 毎分：HPの決済待ちを Square に聞いて確定し、期限切れなら部屋を戻す
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      sweep(env).then(
        (r) => (r.paid || r.expired ? console.log('HP予約の見回り', JSON.stringify(r)) : undefined),
        (e) => console.error('HP予約の見回りに失敗', e),
      ),
    );
  },

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
