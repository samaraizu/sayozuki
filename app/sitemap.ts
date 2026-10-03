import type { MetadataRoute } from "next";
import { foreignLocales, htmlLang, pathFor } from "@/lib/i18n";
import { products } from "@/lib/shop";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    (["ja", ...foreignLocales] as const).map((l) => [htmlLang[l], `${site.url}${pathFor(l) === "/" ? "" : pathFor(l)}`]),
  );
  return [
    { url: site.url, alternates: { languages } },
    ...foreignLocales.map((l) => ({ url: `${site.url}${pathFor(l)}`, alternates: { languages } })),
    { url: `${site.url}/shop` },
    ...products.map((p) => ({ url: `${site.url}/shop/${p.id}` })),
    { url: `${site.url}/shop/legal` },
  ];
}
