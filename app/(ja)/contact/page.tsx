import type { Metadata } from "next";
import { ContactPage } from "@/components/ContactPage";
import { dictionaries } from "@/lib/i18n";

export const metadata: Metadata = {
  title: `${dictionaries.ja.reserve.directTitle}｜${dictionaries.ja.meta.title}`,
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return <ContactPage lang="ja" />;
}
