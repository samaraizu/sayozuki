import Link from "next/link";
import { OtaIcon } from "@/components/OtaIcon";
import { Photo } from "@/components/Photo";
import { Reservation } from "@/components/Reservation";
import { Heading, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { dictionaries, fmt, formatYen, localePath, type Locale } from "@/lib/i18n";
import { products } from "@/lib/shop";
import { intlPhone, meals, otaLinks, photos, rooms, site, telHref } from "@/lib/site";
import { shopUrl } from "@/lib/urls";

const field =
  "h-12 w-full rounded-xl border border-steel bg-mist px-3 text-[15px] text-navy outline-none focus:border-sea focus:ring-2 focus:ring-sea/20";

/** 宿のトップページ。言語ごとに文言だけ差し替える。見た目は「湯と木」（生成り×苔×檜） */
export function InnPage({ lang }: { lang: Locale }) {
  const t = dictionaries[lang];
  const yen = (n: number) => formatYen(lang, n);
  const roomName = (name: string) => t.rooms.names[name] ?? name;
  // 外国語のページでは国際表記にする（海外からかける人向け）
  const phone = (n: string) => (lang === "ja" ? n : intlPhone(n));
  const mapQuery = encodeURIComponent(`${site.address} ${site.name}`);
  // 空室カレンダーはこのページの「ご予約」にある。上の検索は日程をクエリにして同じページの #reserve へ
  const reserveHref = `${localePath(lang)}#reserve`;
  const contactHref = localePath(lang, "/contact");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: site.name,
    alternateName: site.roman,
    url: site.url,
    image: `${site.url}${photos.hero}`,
    address: {
      "@type": "PostalAddress",
      postalCode: site.postalCode.replace("〒", ""),
      addressRegion: "山形県",
      addressLocality: "上山市",
      streetAddress: "葉山5-63",
      addressCountry: "JP",
    },
    priceRange: `${formatYen("ja", Math.min(...rooms.map((r) => r.price)))}〜`,
    telephone: intlPhone(site.tel),
    faxNumber: intlPhone(site.fax),
    sameAs: [site.gbpUrl],
  };

  return (
    <div className="min-h-dvh bg-page text-navy">
      {lang === "ja" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      <SiteHeader lang={lang} onTop />

      <main id="top" className="mx-auto flex max-w-6xl flex-col gap-20 px-4 pt-4 md:gap-28 md:px-6">
        {/* ファーストビューと空室検索。左に言葉と検索、右にアーチの写真 */}
        <section aria-label={site.name} className="grid items-center gap-8 md:grid-cols-[1fr_1.15fr] md:gap-12">
          <div className="order-2 flex flex-col gap-6 md:order-1">
            <p className="self-start rounded-full bg-kinari px-3.5 py-1 text-[13px] font-medium text-umber">{t.hero.tagline}</p>
            <h1 className="font-mincho text-[28px] font-bold leading-[1.6] tracking-[0.04em] break-keep sm:text-[34px] md:text-[44px] md:tracking-[0.06em]">
              {t.about.lead[0]}
              <br />
              {t.about.lead[1]}
            </h1>

            {/* 空室を見る：日程を下の空室カレンダー（#reserve）へ持っていく */}
            <form
              action={reserveHref}
              method="get"
              className="grid grid-cols-2 gap-3 rounded-[20px] border border-frost bg-white p-4 shadow-soft"
            >
              <label className="col-span-2 flex flex-col gap-1.5 text-[12px] font-bold text-slate">
                {t.form.checkin}
                <input type="date" name="in" className={field} />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-slate">
                {t.form.nights}
                <select name="nights" defaultValue="1" className={field}>
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {fmt(t.form.nightUnit, { n })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-slate">
                {t.form.guests}
                <select name="guests" defaultValue="2" className={field}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {fmt(t.form.guestUnit, { n })}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="col-span-2 h-[52px] rounded-2xl bg-wood px-8 text-[15px] font-bold text-white shadow-cta transition-colors hover:bg-wood-deep active:scale-95">
                {t.book.heroCta}
              </button>
            </form>
          </div>
          <div className="order-1 md:order-2">
            <Photo src={photos.hero} alt={t.hero.alt} priority sizes="(min-width: 768px) 55vw, 100vw" className="arch h-[52svh] min-h-[360px] md:h-[600px]" />
          </div>
        </section>

        {/* 小夜月について */}
        <section id="about" className="grid scroll-mt-6 items-center gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <Heading en="CONCEPT" ja={t.about.title} />
            <div className="space-y-5 text-[15px] leading-8 text-slate">
              {t.about.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Photo src={photos.lobby} alt={t.about.altLobby} sizes="(min-width: 768px) 25vw, 50vw" className="aspect-[3/4] rounded-[24px]" />
            <Photo src={photos.noren} alt={t.about.altNoren} sizes="(min-width: 768px) 25vw, 50vw" className="arch mt-10 aspect-[3/4]" />
          </div>
        </section>

        {/* 温泉 */}
        {/* 温泉は苔色の帯。ページの中で一か所だけ色の面にする */}
        <section id="onsen" className="grid scroll-mt-6 items-center gap-8 rounded-[32px] bg-sea p-5 text-cream md:grid-cols-2 md:gap-10 md:p-12">
          <div className="order-2 flex flex-col gap-5 md:order-1">
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-bold tracking-[0.24em] text-[#D6C7A8]">ONSEN</p>
              <h2 className="font-mincho text-[26px] font-bold leading-snug md:text-[32px]">{t.onsen.title}</h2>
            </div>
            <p className="text-[15px] leading-8 text-[#DCD6C8]">{t.onsen.body}</p>
            <div className="rounded-2xl bg-cream/10 px-4 py-3.5">
              <p className="text-[12px] font-bold text-[#D6C7A8]">{t.onsen.qualityLabel}</p>
              <p className="mt-0.5 font-bold">{t.onsen.quality}</p>
            </div>
            <div>
              <p className="text-[12px] font-bold text-[#D6C7A8]">{t.onsen.benefitsLabel}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {t.onsen.benefits.map((b) => (
                  <li key={b} className="flex h-8 items-center rounded-full bg-cream/15 px-3 text-[13px]">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Photo src={photos.onsen} alt={t.onsen.alt} sizes="(min-width: 768px) 50vw, 100vw" className="order-1 aspect-[4/3] rounded-[24px] md:order-2 md:aspect-auto md:h-[420px]" />
        </section>

        {/* 客室 */}
        <section id="rooms" className="scroll-mt-6">
          <Heading en="ROOMS" ja={t.rooms.title} lead={fmt(t.rooms.body, { n: rooms.length })} />
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <Photo src={photos.room} alt={t.rooms.altRoom} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10] rounded-[24px]" />
            <Photo src={photos.corridor} alt={t.rooms.altCorridor} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[16/10] rounded-[24px] md:aspect-auto" />
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <li key={r.name} className="flex flex-col gap-1.5 rounded-[24px] border border-frost bg-white px-5 py-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mincho text-xl font-semibold">{roomName(r.name)}</p>
                  <span className="rounded-lg bg-mint px-2.5 py-0.5 text-[12px] font-bold text-pine">{fmt(t.rooms.capacity, { n: r.capacity })}</span>
                </div>
                {r.note && <p className="text-[13px] text-slate">{t.rooms.familyNote}</p>}
                <p className="text-lg font-bold tabular-nums">
                  {yen(r.price)}
                  <span className="ml-2 text-[12px] font-medium text-slate">{t.price.caption}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ご料金 */}
        <section id="price" className="grid scroll-mt-6 gap-4 md:grid-cols-2">
          <div className="rounded-[24px] bg-white p-6 shadow-soft md:p-8">
            <Heading en="PRICE" ja={t.price.title} />
            <ul className="-mt-2 space-y-2 text-[13px] leading-6 text-slate">
              {t.price.notes.map((n) => (
                <li key={n}>※ {n}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 rounded-[24px] bg-white p-6 shadow-soft md:p-8">
            <h3 className="font-mincho text-xl font-semibold">{t.price.mealsTitle}</h3>
            <p className="text-[13px] leading-6 text-slate">{t.price.mealsNote}</p>
            {photos.meal && <Photo src={photos.meal} alt={t.price.altMeal} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[4/3] rounded-2xl" />}
            <div className="flex items-center justify-between rounded-2xl bg-sky px-4 py-3.5">
              <span className="font-bold">{t.price.breakfast}</span>
              <span className="tabular-nums">{fmt(t.price.perPerson, { price: yen(meals.breakfast) })}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-sky px-4 py-3.5">
              <span className="font-bold">{t.price.dinner}</span>
              <span className="tabular-nums">{fmt(t.price.perPerson, { price: yen(meals.dinner) })}</span>
            </div>
          </div>
        </section>

        {/* お取り寄せ（site.showSakeSection で出し入れ） */}
        {site.showSakeSection && (
          <section className="rounded-[32px] bg-white p-6 shadow-soft md:p-10">
            <Heading en={t.sake.en} ja={t.nav.shop} lead={t.sake.lead} />
            <div lang="ja">
              <ProductGrid items={products} />
            </div>
            <Link href={shopUrl("/")} className="mt-6 inline-flex h-11 items-center rounded-xl border border-sea px-5 text-[14px] font-bold text-sea-deep">
              {t.sake.more}
            </Link>
          </section>
        )}

        {/* ご予約 */}
        <section id="reserve" className="scroll-mt-6">
          <Heading en="RESERVATION" ja={t.book.title} lead={t.book.lead} />
          {/* 空室カレンダーと事前決済。ページを移らずにここで予約まで進める */}
          <Reservation lang={lang} t={t} roomNames={t.rooms.names} />

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {otaLinks.map((o) => {
              const name = t.reserve.otaNames[o.name] ?? o.name;
              return o.url ? (
                <a
                  key={o.name}
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-[24px] border border-frost bg-white px-5 py-4 shadow-soft"
                >
                  <span className="flex items-center gap-3 font-bold">
                    <OtaIcon name={o.icon} className="text-sea" />
                    {fmt(t.reserve.otaBook, { name })}
                  </span>
                  <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-sea text-cream">
                    →
                  </span>
                </a>
              ) : (
                <span key={o.name} className="flex items-center justify-between gap-3 rounded-[24px] border border-frost bg-navy/[0.04] px-5 py-4 text-slate">
                  <span className="flex items-center gap-3 font-bold">
                    <OtaIcon name={o.icon} className="text-slate/70" />
                    {name}
                  </span>
                  <span className="rounded-lg border border-dashed border-dash px-2.5 py-1 text-[12px]">{t.reserve.otaSoon}</span>
                </span>
              );
            })}
          </div>

          {/* お問い合わせはフォームを別ページ（/contact）に分けた */}
          <div className="mt-4 flex flex-col gap-4 rounded-[32px] bg-white p-6 shadow-soft md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h3 className="font-mincho text-xl font-semibold">{t.reserve.directTitle}</h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-slate">{t.reserve.directBody}</p>
            </div>
            <a
              href={contactHref}
              className="flex h-12 shrink-0 items-center justify-center rounded-2xl border border-sea px-6 text-[15px] font-bold text-sea-deep transition-colors hover:bg-sea/5"
            >
              {t.reserve.contactCta} →
            </a>
          </div>
        </section>

        {/* アクセス */}
        <section id="access" className="grid scroll-mt-6 gap-6 rounded-[32px] bg-white p-6 shadow-soft md:grid-cols-2 md:p-10">
          <div>
            <Heading en="ACCESS" ja={t.access.title} />
            <dl className="grid content-start gap-x-6 gap-y-4 text-[15px] md:grid-cols-[7rem_1fr]">
              <dt className="text-[13px] font-bold text-slate">{t.access.addressLabel}</dt>
              <dd className="leading-7">
                {t.access.address[0]}
                <br />
                {t.access.address[1]}
                <a href={site.gbpUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-[14px] font-bold text-sea-deep underline-offset-4 hover:underline">
                  {t.access.map} →
                </a>
              </dd>
              <dt className="text-[13px] font-bold text-slate">{t.access.telLabel}</dt>
              <dd>
                <a href={telHref(site.tel)} className="underline-offset-4 hover:underline">
                  {phone(site.tel)}
                </a>
              </dd>
              <dt className="text-[13px] font-bold text-slate">{t.access.faxLabel}</dt>
              <dd>{phone(site.fax)}</dd>
              <dt className="text-[13px] font-bold text-slate">{t.access.nearestLabel}</dt>
              <dd className="leading-7">{t.access.nearest}</dd>
              <dt className="text-[13px] font-bold text-slate">{t.access.aroundLabel}</dt>
              <dd className="leading-7">{t.access.around}</dd>
            </dl>
          </div>
          <iframe
            title={t.access.mapTitle}
            src={`https://www.google.com/maps?q=${mapQuery}&output=embed&hl=${lang === "zh" ? "zh-CN" : lang}`}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-[24px] border border-frost"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
