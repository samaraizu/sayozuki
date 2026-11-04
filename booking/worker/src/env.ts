export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID?: string; // Google Cloud の OAuth クライアント（ウェブアプリケーション）
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string; // ログイン状態のクッキーの署名（32文字以上の乱数）
  ALLOWED_EMAILS?: string;
  SYNC_TOKEN?: string;
  DEV_EMAIL?: string; // 手元の wrangler dev だけ（.dev.vars）。本番には入れない
  // HPの事前決済（src/hp.ts）
  SQUARE_ACCESS_TOKEN?: string; // 客室オーダーと同じ Square アカウント
  SQUARE_LOCATION_ID?: string;
  SQUARE_ENV?: string; // production / sandbox
  SQUARE_MOCK?: string; // 1 = Square を呼ばずに払ったことにする（手元だけ）
  RESEND_API_KEY?: string; // 確認メール
  MAIL_FROM?: string;
  MAIL_TO?: string; // 宿への通知先（カンマ区切り）
}

export class UserError extends Error {}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function todayIso(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

export function nowText(now = new Date()): string {
  return now.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 16).replace(/-/g, '/');
}
