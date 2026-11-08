import { InquiryForm } from "@/components/InquiryForm";
import { Heading, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { dictionaries, localePath, type Locale } from "@/lib/i18n";

/** 宿へ直接のお問い合わせ。トップの「ご予約」のボタンから来る。送り先は app/actions.ts（メール＋予約管理） */
export function ContactPage({ lang }: { lang: Locale }) {
  const t = dictionaries[lang];
  return (
    <div className="min-h-dvh bg-page text-navy">
      <SiteHeader lang={lang} sub="/contact" />
      <main className="mx-auto max-w-3xl px-4 pt-8 md:px-6 md:pt-12">
        <Heading en="CONTACT" ja={t.reserve.directTitle} lead={t.reserve.directBody} />
        <div className="rounded-[28px] bg-white p-6 shadow-soft md:p-10">
          <InquiryForm lang={lang} t={t.form} roomNames={t.rooms.names} />
        </div>
        <p className="mt-6 text-center text-[14px]">
          <a href={`${localePath(lang)}#reserve`} className="font-bold text-sea-deep underline underline-offset-4">
            {t.book.navLabel} →
          </a>
        </p>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
