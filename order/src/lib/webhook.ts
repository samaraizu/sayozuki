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
