import type { Metadata } from "next";
import { GuideIndex } from "@/components/GuidePage";
import { guideUI } from "@/lib/guide";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${guideUI.ja.guide}｜${site.name}`,
  robots: { index: false },
};

export default function GuideTop() {
  return <GuideIndex lang="ja" />;
}
