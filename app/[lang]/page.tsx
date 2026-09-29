import { notFound } from "next/navigation";
import { InnPage } from "@/components/InnPage";
import { isLocale } from "@/lib/i18n";

export default async function LocalizedHome({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang) || lang === "ja") notFound();
  return <InnPage lang={lang} />;
}
