import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactPage } from "@/components/ContactPage";
import { dictionaries, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dictionaries[lang];
  return { title: `${t.reserve.directTitle}｜${t.meta.title}`, alternates: { canonical: `/${lang}/contact` } };
}

export default async function LocalizedContact({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "ja") notFound();
  return <ContactPage lang={lang} />;
}
