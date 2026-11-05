import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservePage } from "@/components/ReservePage";
import { dictionaries, isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/reserve">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dictionaries[lang];
  return { title: `${t.book.title}｜${t.meta.title}`, alternates: { canonical: `/${lang}/reserve` } };
}

export default async function LocalizedReserve({ params }: PageProps<"/[lang]/reserve">) {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "ja") notFound();
  return <ReservePage lang={lang} />;
}
