import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 注文手続きと帳票のフォーマット案は検索結果に出さない
      // shop.sayozuki.com では /shop を付けないパスになるので両方書く
      disallow: ["/shop/cart", "/shop/checkout", "/shop/complete", "/cart", "/checkout", "/complete", "/documents"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
