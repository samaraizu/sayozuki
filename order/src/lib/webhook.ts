import { timingSafeEqual } from './util';

/**
 * Squareのwebhook署名検証。
 * 署名 = Base64( HMAC-SHA256( 署名キー, 通知URL + 生のリクエストボディ ) )
 * ヘッダー: x-square-hmacsha256-signature
 */
export async function verifySquareSignature(signatureKey: string, notificationUrl: string, body: string, signature: string | null) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signatureKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(notificationUrl + body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}

/**
 * 署名を確かめる通知URLの候補。PUBLIC_ORIGIN（正式なドメイン）と、実際にリクエストが届いたURL。
 * Square 側の通知先が workers.dev のままでも order.sayozuki.com でも通るようにする。
 * どちらも署名キーがないと一致しないので、受け付ける範囲は広がらない。
 */
export function notificationUrls(publicOrigin: string, url: URL): string[] {
  const base = `${publicOrigin.replace(/\/$/, '')}${url.pathname}`;
  const actual = `${url.origin}${url.pathname}`;
  return base === actual ? [base] : [base, actual];
}

export async function verifySquareSignatureAny(signatureKey: string, urls: string[], body: string, signature: string | null) {
  for (const u of urls) if (await verifySquareSignature(signatureKey, u, body, signature)) return true;
  return false;
}
