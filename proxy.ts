import { NextResponse, type NextRequest } from "next/server";

/**
 * 宿（sayozuki.com）とお取り寄せ（shop.sayozuki.com）の振り分け。
 *
 * - shop.〜 で来たら /shop の下を見せる（URLに /shop は出さない）
 * - NEXT_PUBLIC_SPLIT_DOMAINS=true のとき、宿側の /shop は shop.sayozuki.com へ転送する
 *   （ドメイン接続前に有効にすると本番が仮ページへ飛ぶので、接続を確認してから入れる）
 *
 * Proxy は描画コードと別に動くので、lib/urls.ts を読み込まずに値をここに持つ。
 */
const INN_HOST = "sayozuki.com";
const SHOP_HOST = "shop.sayozuki.com";

/** shop.〜 でも /shop を付けずにそのまま返すもの */
const PASS = ["/documents", "/robots.txt", "/sitemap.xml"];

const stripShop = (p: string) => p.replace(/^\/shop(?=\/|$)/, "") || "/";

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const { pathname, search } = req.nextUrl;
  const underShop = pathname === "/shop" || pathname.startsWith("/shop/");

  if (host.startsWith("shop.")) {
    // /shop/cart のような古い形のURLは /cart に揃える
    if (underShop) {
      const url = req.nextUrl.clone();
      url.pathname = stripShop(pathname);
      return NextResponse.redirect(url, 308);
    }
    if (PASS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/shop" : `/shop${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (process.env.NEXT_PUBLIC_SPLIT_DOMAINS === "true" && process.env.VERCEL_ENV === "production") {
    // 宿側の /shop はお取り寄せのドメインへ
    if (underShop) return NextResponse.redirect(`https://${SHOP_HOST}${stripShop(pathname)}${search}`, 308);
    // vercel.app や www で来た本番アクセスは sayozuki.com へまとめる
    if (host !== INN_HOST) return NextResponse.redirect(`https://${INN_HOST}${pathname}${search}`, 308);
  }

  return NextResponse.next();
}

export const config = {
  // 画像・ビルド成果物・favicon は通さない
  matcher: ["/((?!_next/|images/|favicon.ico).*)"],
};
