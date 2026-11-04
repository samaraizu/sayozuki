import { AutoRefresh } from "@/components/AutoRefresh";
import { Moon, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { bookingApi, type CheckoutStatus } from "@/lib/booking-api";
import { dictionaries, fmt, formatYen, htmlLang, localePath, type Locale } from "@/lib/i18n";

/** Square から戻ってくる完了画面。払われたかを予約管理に聞いて出し分ける */
export async function ReserveDone({ lang, no, keyParam }: { lang: Locale; no: string; keyParam: string }) {
  const t = dictionaries[lang];
  const b = t.book;
  let s: CheckoutStatus = { status: "unknown" };
  const api = no && keyParam ? await bookingApi() : null;
  if (api) {
    try {
      s = await api.checkoutStatus(no, keyParam);
    } catch (e) {
      console.error("[reserve] 予約の状態を取れなかった", e);
    }
  }
  const date = (iso?: string) =>
    iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(htmlLang[lang], { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" }) : "";
  const title = { paid: b.paidTitle, pending: b.pendingTitle, expired: b.expiredTitle, failed: b.expiredTitle, unknown: b.unknownTitle }[s.status];
  const body = { paid: b.paidBody, pending: b.pendingBody, expired: b.expiredBody, failed: b.expiredBody, unknown: b.unknownBody }[s.status];

  return (
    <div className="min-h-dvh bg-page text-navy">
      <SiteHeader lang={lang} sub="/reserve" />
      <main className="mx-auto max-w-xl px-4 pt-10 md:pt-16">
        <section className="flex flex-col items-center gap-4 rounded-[28px] bg-white px-6 py-10 text-center shadow-soft" aria-live="polite">
          <span className={`flex size-16 items-center justify-center rounded-full ${s.status === "paid" ? "bg-grad text-white" : "bg-sky text-sea"}`}>
            <Moon className="size-8" />
          </span>
          <h1 className="font-serif text-2xl font-semibold">{title}</h1>
          <p className="text-[15px] leading-8 text-slate">{body}</p>
          {s.no && (s.status === "paid" || s.status === "pending") && (
            <dl className="mt-2 grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-sky px-5 py-4 text-left text-[14px]">
              <dt className="text-slate">{b.no}</dt>
              <dd className="text-right font-bold">{s.no}</dd>
              {s.room && (
                <>
                  <dt className="text-slate">{b.summaryRoom}</dt>
                  <dd className="text-right font-bold">{t.rooms.names[s.room] ?? t.rooms.names[`${s.room}号室`] ?? s.room}</dd>
                </>
              )}
              {s.checkIn && s.checkOut && (
                <>
                  <dt className="text-slate">{b.summaryDates}</dt>
                  <dd className="text-right font-bold">
                    {date(s.checkIn)} → {date(s.checkOut)}
                  </dd>
                </>
              )}
              {s.guests && (
                <>
                  <dt className="text-slate">{b.summaryGuests}</dt>
                  <dd className="text-right font-bold">{fmt(t.form.guestUnit, { n: s.guests })}</dd>
                </>
              )}
              {s.amount && (
                <>
                  <dt className="text-slate">{b.total}</dt>
                  <dd className="text-right font-bold">{formatYen(lang, s.amount)}</dd>
                </>
              )}
            </dl>
          )}
          {s.status === "pending" && (
            <>
              {s.payUrl && (
                <a href={s.payUrl} className="flex h-12 items-center rounded-2xl bg-grad px-6 font-bold text-white shadow-cta">
                  {b.resume}
                </a>
              )}
              <AutoRefresh seconds={4} />
            </>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-[14px] font-bold">
            {s.status !== "paid" && s.status !== "pending" && (
              <a href={localePath(lang, "/reserve")} className="flex h-11 items-center rounded-xl bg-grad px-5 text-white">
                {b.again}
              </a>
            )}
            <a href={localePath(lang)} className="flex h-11 items-center rounded-xl border border-sea px-5 text-sea-deep">
              {b.backTop}
            </a>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
