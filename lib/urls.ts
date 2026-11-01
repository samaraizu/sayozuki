/**
 * 宿（sayozuki.com）とお取り寄せ（shop.sayozuki.com）を分けて公開するためのURL。
 *
 * NEXT_PUBLIC_SPLIT_DOMAINS=true のときだけサブドメインに分ける。
 * 未設定（ローカル・プレビュー・ドメイン接続前の本番）では今までどおり /shop の下に出す。
 * ビルド時に埋め込まれる値なので、DNS の切り替えが終わってから、ビルドする環境（ローカルなら .env.production）に入れてデプロイし直すこと。
 * Cloudflare の Worker の変数に入れても効かない。
 */
export const domains = { inn: "sayozuki.com", shop: "shop.sayozuki.com" } as const;
export const innOrigin = `https://${domains.inn}`;
export const shopOrigin = `https://${domains.shop}`;

export const splitDomains = process.env.NEXT_PUBLIC_SPLIT_DOMAINS === "true";

/** "/cart" "/#lineup" "/?tag=辛口" などを /shop の下のパスにする */
const underShop = (p: string) => (p === "/" ? "/shop" : p.startsWith("/#") || p.startsWith("/?") ? `/shop${p.slice(1)}` : `/shop${p}`);

/** お取り寄せの中のリンク（お取り寄せのページから使う） */
export const shopPath = (p = "/") => (splitDomains ? p : underShop(p));

/** 宿のページからお取り寄せへのリンク */
export const shopUrl = (p = "/") => (splitDomains ? `${shopOrigin}${p === "/" ? "" : p}` : underShop(p));

/** お取り寄せのページから宿へのリンク */
export const innUrl = (p = "/") => (splitDomains ? `${innOrigin}${p}` : p);
