import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dictionaries, foreignLocales, htmlLang, isLocale, languageAlternates, pathFor } from "@/lib/i18n";
import { fontVariables } from "@/lib/fonts";
import { site } from "@/lib/site";
import "../globals.css";

export function generateStaticParams() {
  return foreignLocales.map((lang) => ({ lang }));
}

export const dynamicParams = false;

const ogLocale = { en: "en_US", zh: "zh_CN", vi: "vi_VN", th: "th_TH", ko: "ko_KR" } as Record<string, string>;

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dictionaries[lang];
  return {
    metadataBase: new URL(site.url),
    title: t.meta.title,
    description: t.meta.description,
    alternates: { canonical: pathFor(lang), languages: languageAlternates },
    openGraph: { title: t.meta.title, description: t.meta.description, locale: ogLocale[lang], type: "website" },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "ja") notFound();
  return (
    <html lang={htmlLang[lang]} className={`${fontVariables} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
