/**
 * 客室オーダーのスタッフ画面を、予約管理と同じ入口（booking.sayozuki.com/staff/）で開けるようにする。
 * スマホのホーム画面アプリを「小夜月 予約」1つにまとめるため（2026-11-13）。
 *
 * 中身は客室オーダーの Worker「sayozuki-order」がそのまま返す（サービスバインディング ORDER で中継するだけ）。
 * - 予約管理の「Googleでログイン」が済んでいる人だけ通す。その先でオーダーのPINも要る（二重ロック）
 * - 中継先のURLは order.sayozuki.com に置き換える。客室QR・支払いリンクはスタッフ画面を開いたドメインで作られるため、
 *   ここで置き換えないと booking.sayozuki.com 宛てのQRができてしまう
 * - 予約管理のログインのクッキーはオーダー側に渡さない
 * order.sayozuki.com/staff/ もこれまでどおり使える。
 */
import { SESSION_COOKIE, cookieHeader, currentUser, readCookie } from './auth';
import { json, type Env } from './env';

export const ORDER_ORIGIN = 'https://order.sayozuki.com';

/** スタッフ画面が読むパス（staff.js が ../dishes.js と /images/menu/ の写真を使う） */
export function isOrderPath(path: string): boolean {
  return path === '/staff' || path.startsWith('/staff/') || path === '/dishes.js' || path.startsWith('/images/menu/');
}

export async function proxyOrder(req: Request, env: Env, url: URL): Promise<Response> {
  const email = await currentUser(req, env);
  if (!email) {
    if (url.pathname.startsWith('/staff/api/')) {
      // staff.js は 401 を「PIN違い」と見てPINを消すので、別の番号で返して画面を移らせる
      return json({ error: 'login', detail: '予約管理にログインして' }, 403);
    }
    const res = new Response(null, { status: 302, headers: { location: '/login', 'cache-control': 'no-store' } });
    if (readCookie(req, SESSION_COOKIE)) res.headers.append('set-cookie', cookieHeader(SESSION_COOKIE, '', 0));
    return res;
  }
  if (!env.ORDER) return json({ error: 'not_configured', detail: 'サービスバインディング ORDER が無い' }, 500);

  const target = new URL(url.pathname + url.search, ORDER_ORIGIN);
  const headers = new Headers(req.headers);
  headers.delete('cookie');
  // オーダー側の書き込みはPINで確かめている。Origin は中継先に合わせておく
  if (headers.has('origin')) headers.set('origin', ORDER_ORIGIN);
  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    (init as RequestInit & { duplex?: string }).duplex = 'half'; // 本文を流したまま渡す（Node のテストでも動くように）
  }
  const res = await env.ORDER.fetch(new Request(target, init));

  // オーダー側が自分のドメインへ転送してきたら、この入口のパスに戻す
  const loc = res.headers.get('location');
  if (loc && loc.startsWith(ORDER_ORIGIN)) {
    const out = new Response(res.body, res);
    out.headers.set('location', loc.slice(ORDER_ORIGIN.length) || '/');
    return out;
  }
  return res;
}
