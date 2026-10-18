import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideIndex } from "@/components/GuidePage";
import { guideUI, isGuideLocale } from "@/lib/guide";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/guide">): Promise<Metadata> {
  const { lang } = await params;
  if (!isGuideLocale(lang)) return {};
  return { title: `${guideUI[lang].guide} | ${site.roman}`, robots: { index: false } };
}

/** ご案内は日本語・英語・中国語・韓国語のみ。ベトナム語・タイ語は 404 */
export default async function LocalizedGuideTop({ params }: PageProps<"/[lang]/guide">) {
  const { lang } = await params;
  if (!isGuideLocale(lang) || lang === "ja") notFound();
  return <GuideIndex lang={lang} />;
}
