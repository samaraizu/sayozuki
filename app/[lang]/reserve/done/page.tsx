import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReserveDone } from "@/components/ReserveDone";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function LocalizedDone({ params, searchParams }: PageProps<"/[lang]/reserve/done">) {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "ja") notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <ReserveDone lang={lang} no={one(sp.no)} keyParam={one(sp.key)} />;
}
