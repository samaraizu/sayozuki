import type { Metadata } from "next";
import { InnPage } from "@/components/InnPage";
import { languageAlternates } from "@/lib/i18n";

export const metadata: Metadata = {
  alternates: { canonical: "/", languages: languageAlternates },
};

export default function Home() {
  return <InnPage lang="ja" />;
}
