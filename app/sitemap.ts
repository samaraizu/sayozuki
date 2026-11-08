import type { MetadataRoute } from "next";
import { foreignLocales, htmlLang, localePath, pathFor } from "@/lib/i18n";
import { products } from "@/lib/shop";
import { site } from "@/lib/site";
import { shopUrl } from "@/lib/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    (["ja", ...foreignLocales] as const).map((l) => [htmlLang[l], `${site.url}${pathFor(l) === "/" ? "" : pathFor(l)}`]),
  );
  return [
    { url: site.url, alternates: { languages } },
    ...foreignLocales.map((l) => ({ url: `${site.url}${pathFor(l)}`, alternates: { languages } })),
    // 予約ページ（空室カレンダー）
    ...(["ja", ...foreignLocales] as const).map((l) => ({ url: `${site.url}${localePath(l, "/reserve")}` })),
    // お問い合わせページ
    ...(["ja", ...foreignLocales] as const).map((l) => ({ url: `${site.url}${localePath(l, "/contact")}` })),
    // サブドメインに分けていないときは shopUrl が /shop〜 を返すので、宿のURLを前に付ける
    ...["/", ...products.map((p) => `/${p.id}`), "/legal"].map((p) => {
      const u = shopUrl(p);
      return { url: u.startsWith("http") ? u : `${site.url}${u}` };
    }),
  ];
}
