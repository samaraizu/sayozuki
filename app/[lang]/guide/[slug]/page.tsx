import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuidePage } from "@/components/GuidePage";
import { guideDoc, guideSlugs, isGuideLocale, isGuideSlug } from "@/lib/guide";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { lang: string } }) {
  return isGuideLocale(params.lang) ? guideSlugs.map((slug) => ({ slug })) : [];
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
