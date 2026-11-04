import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuidePage } from "@/components/GuidePage";
import { guideDoc, guideLocales, guideSlugs, isGuideLocale, isGuideSlug } from "@/lib/guide";
import { site } from "@/lib/site";

export const dynamicParams = false;

// 親の [lang] から params を受け取る形だと、本番ビルドで英中韓の個別ページが作られず404になったため、言語×ページを自分で全部並べる
export function generateStaticParams() {
  return guideLocales.filter((lang) => lang !== "ja").flatMap((lang) => guideSlugs.map((slug) => ({ lang, slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/guide/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isGuideLocale(lang) || !isGuideSlug(slug)) return {};
  return { title: `${guideDoc(lang, slug).title} | ${site.roman}`, robots: { index: false } };
}

export default async function LocalizedGuidePage({ params }: PageProps<"/[lang]/guide/[slug]">) {
  const { lang, slug } = await params;
  if (!isGuideLocale(lang) || lang === "ja" || !isGuideSlug(slug)) notFound();
  return <GuidePage lang={lang} slug={slug} />;
}
