import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuidePage } from "@/components/GuidePage";
import { guideDoc, guideSlugs, isGuideSlug } from "@/lib/guide";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return guideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/guide/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isGuideSlug(slug)) return {};
  return { title: `${guideDoc("ja", slug).title}｜${site.name}`, robots: { index: false } };
}

export default async function GuideSlugPage({ params }: PageProps<"/guide/[slug]">) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) notFound();
  return <GuidePage lang="ja" slug={slug} />;
}
