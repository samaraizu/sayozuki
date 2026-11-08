import { Reservation } from "@/components/Reservation";
import { Heading, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { dictionaries, localePath, type Locale } from "@/lib/i18n";

/** 空室カレンダーから選んで、Square で事前決済する予約ページ */
export function ReservePage({ lang }: { lang: Locale }) {
  const t = dictionaries[lang];
  return (
    <div className="min-h-dvh bg-page text-navy">
      <SiteHeader lang={lang} sub="/reserve" />
      <main className="mx-auto max-w-6xl px-4 pt-8 md:px-6 md:pt-12">
        <Heading en="RESERVATION" ja={t.book.title} lead={t.book.lead} />
        <Reservation lang={lang} t={t} roomNames={t.rooms.names} />
        <p className="mt-6 text-center text-[14px]">
          <a href={localePath(lang, "/contact")} className="font-bold text-sea-deep underline underline-offset-4">
            {t.book.questions} →
          </a>
        </p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
