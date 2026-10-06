import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { OtaIcon } from "@/components/OtaIcon";
import { Photo } from "@/components/Photo";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { Chip, Crest, MoreLink, PhotoBand, SectionHeading } from "@/components/ui";
import { dictionaries, fmt, formatYen, type Locale } from "@/lib/i18n";
import { products } from "@/lib/shop";
import { meals, otaLinks, photos, rooms, site } from "@/lib/site";
import { shopUrl } from "@/lib/urls";

/** 宿のトップページ。言語ごとに文言だけ差し替える */
export function InnPage({ lang }: { lang: Locale }) {
  const t = dictionaries[lang];
  const yen = (n: number) => formatYen(lang, n);
  const roomName = (name: string) => t.rooms.names[name] ?? name;
  const mapQuery = encodeURIComponent(`${site.address} ${site.name}`);

  const nav = [
    ["#about", t.nav.about],
    ["#onsen", t.nav.onsen],
    ["#rooms", t.nav.rooms],
    ["#price", t.nav.price],
    ["#reserve", t.nav.reserve],
    ["#access", t.nav.access],
  ] as const;

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
    sameAs: [site.gbpUrl],
  };

  return (
    <>
      {lang === "ja" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      <header className="relative z-40 bg-white">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 md:h-20 md:px-5">
          <a href="#top" className="flex items-center gap-3">
            <Crest className="size-11 md:size-14" />
            <span className="leading-tight">
              <span lang="ja" className="block font-serif-ja text-lg tracking-[0.2em]">
                {site.name}
              </span>
              <span className="hidden text-[11px] text-sub sm:block">{t.hero.tagline}</span>
            </span>
          </a>
          <div className="flex items-end gap-1 md:gap-2">
            <LanguageSwitcher lang={lang} />
            {site.showSakeSection && (
              <Link href={shopUrl("/")} hrefLang="ja" className="flex flex-col items-center gap-0.5 px-2 text-[10px] hover:text-green" aria-label={t.nav.shop}>
                <svg viewBox="0 0 28 28" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
                  <path d="M12 2h4v6c0 1.5 3 3 3 6.5V25a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V14.5C9 11 12 9.5 12 8z" />
                  <path d="M9 16h10v6H9z" />
                </svg>
                <span className="hidden md:block">SAKE</span>
              </Link>
            )}
            <a
              href="#reserve"
              className="ml-1 self-center bg-green px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-85"
            >
              {t.nav.reserve}
            </a>
          </div>
        </div>
        <nav className="border-y border-line">
          <ul className="mx-auto flex max-w-6xl justify-between gap-6 overflow-x-auto px-4 text-[13px] whitespace-nowrap md:px-5 md:text-[15px]">
            {nav.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="block py-3.5 hover:text-green md:py-4">
                  {label}
                </a>
              </li>
            ))}
            {site.showSakeSection && (
              <li>
                <Link href={shopUrl("/")} hrefLang="ja" className="block py-3.5 text-green hover:opacity-80 md:py-4">
                  {t.nav.shop}
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </header>

      <main id="top">
        {/* ファーストビュー */}
        <section className="relative h-[72svh] min-h-[460px] overflow-hidden md:h-[680px]">
          <div className="absolute inset-0">
            <Photo src={photos.hero} alt={t.hero.alt} priority className="h-full" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
          <div className="relative mx-auto flex h-full max-w-6xl items-center px-6 md:px-10">
            <div className="text-white">
              <p className="font-en text-xl font-medium tracking-[0.08em] md:text-3xl">KAMINOYAMA ONSEN</p>
              <div className="mt-6 flex items-center gap-5">
                <Crest tone="white" className="size-20 md:size-28" />
                <div>
                  <h1 lang="ja" className="font-serif-ja text-4xl tracking-[0.3em] md:text-6xl">
                    {site.name}
                  </h1>
                  <p className="mt-3 font-en text-xs tracking-[0.4em] opacity-90 md:text-sm">{site.roman}</p>
                </div>
              </div>
              <p className="mt-6 font-brush text-base md:text-xl">{t.hero.tagline}</p>
            </div>
          </div>
        </section>

        {/* 小夜月について */}
        <section id="about" className="mx-auto max-w-6xl px-4 py-20 md:px-5 md:py-24">
          <SectionHeading en="CONCEPT" ja={t.about.title} />
          <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <p className="font-brush text-2xl font-bold leading-[1.9] md:text-3xl">
                {t.about.lead[0]}
                <br />
                {t.about.lead[1]}
              </p>
              <div className="mt-8 space-y-5 text-[15px] leading-8 text-sub">
                {t.about.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Photo src={photos.lobby} alt={t.about.altLobby} sizes="(min-width: 768px) 25vw, 50vw" className="aspect-[3/4]" />
              <Photo src={photos.noren} alt={t.about.altNoren} sizes="(min-width: 768px) 25vw, 50vw" className="aspect-[3/4]" />
            </div>
          </div>
        </section>

        {/* 温泉 */}
        <section id="onsen" className="scroll-mt-4 pb-20 md:pb-24">
          <PhotoBand image={photos.onsen} alt={t.onsen.alt} title={t.onsen.title} lead={`${t.onsen.qualityLabel}：${t.onsen.quality}`}>
            <div className="relative mt-8 flex flex-wrap justify-center gap-2 px-4">
              {t.onsen.benefits.slice(0, 8).map((b) => (
                <Chip key={b}>#{b}</Chip>
              ))}
            </div>
            <div className="relative mx-auto mt-10 max-w-4xl px-4 md:px-5">
              <div className="bg-white px-6 py-10 shadow-sm ring-1 ring-line md:px-12">
                <p className="text-[15px] leading-8">{t.onsen.body}</p>
                <dl className="mt-8 grid gap-6 border-t border-line pt-8 text-sm md:grid-cols-[8rem_1fr]">
                  <dt className="font-bold">{t.onsen.qualityLabel}</dt>
                  <dd>{t.onsen.quality}</dd>
                  <dt className="font-bold">{t.onsen.benefitsLabel}</dt>
                  <dd className="leading-7 text-sub">{t.onsen.benefits.join(" / ")}</dd>
                </dl>
              </div>
            </div>
          </PhotoBand>
        </section>

        {/* 客室 */}
        <section id="rooms" className="bg-surface px-4 py-20 md:px-5 md:py-24">
          <SectionHeading en="ROOMS" ja={t.rooms.title} />
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
              <Photo src={photos.room} alt={t.rooms.altRoom} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10]" />
              <Photo src={photos.corridor} alt={t.rooms.altCorridor} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[16/10] md:aspect-auto" />
            </div>
            <p className="mx-auto mt-10 max-w-3xl text-center text-[15px] leading-8 text-sub">
              {fmt(t.rooms.body, { n: rooms.length })}
            </p>
            <ul className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
                <li key={r.name} className="bg-white px-6 py-6">
                  <p className="font-brush text-xl font-bold">{roomName(r.name)}</p>
                  <p className="mt-1 text-[13px] text-sub">
                    {fmt(t.rooms.capacity, { n: r.capacity })}
                    {r.note && ` / ${t.rooms.familyNote}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ご料金 */}
        <section id="price" className="px-4 py-20 md:px-5 md:py-24">
          <SectionHeading en="PRICE" ja={t.price.title} />
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_1fr] md:gap-16">
            <div>
              <table className="w-full border-t-2 border-ink text-[15px]">
                <caption className="mb-3 text-left text-[13px] font-bold">{t.price.caption}</caption>
                <thead className="bg-surface text-[13px]">
                  <tr>
                    <th className="px-3 py-3 text-left font-bold">{t.price.thRoom}</th>
                    <th className="px-3 py-3 text-left font-bold">{t.price.thCapacity}</th>
                    <th className="px-3 py-3 text-right font-bold">{t.price.thPrice}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rooms]
                    .sort((a, b) => b.price - a.price)
                    .map((r) => (
                      <tr key={r.name} className="border-b border-line">
                        <th scope="row" className="px-3 py-4 text-left font-normal">
                          {roomName(r.name)}
                        </th>
                        <td className="px-3 py-4 text-sm text-sub">{fmt(t.price.upTo, { n: r.capacity })}</td>
                        <td className="px-3 py-4 text-right tabular-nums">{yen(r.price)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <ul className="mt-5 space-y-1 text-xs leading-6 text-sub">
                {t.price.notes.map((n) => (
                  <li key={n}>※ {n}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="border-l-4 border-green pl-3 font-brush text-xl font-bold">{t.price.mealsTitle}</h3>
              {photos.meal && (
                <Photo src={photos.meal} alt={t.price.altMeal} sizes="(min-width: 768px) 33vw, 100vw" className="mt-6 aspect-[4/3]" />
              )}
              <dl className="mt-6 border-t-2 border-ink text-[15px]">
                <div className="flex justify-between gap-4 border-b border-line px-3 py-4">
                  <dt>{t.price.breakfast}</dt>
                  <dd className="tabular-nums">{fmt(t.price.perPerson, { price: yen(meals.breakfast) })}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line px-3 py-4">
                  <dt>{t.price.dinner}</dt>
                  <dd className="tabular-nums">{fmt(t.price.perPerson, { price: yen(meals.dinner) })}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-6 text-sub">{t.price.mealsNote}</p>
            </div>
          </div>
        </section>

        {/* お取り寄せ（site.showSakeSection で出し入れ） */}
        {site.showSakeSection && (
          <section className="pb-20 md:pb-24">
            <SectionHeading en={t.sake.en} ja={t.nav.shop} />
            <PhotoBand image={photos.room} alt={t.rooms.altRoom} title={t.sake.title} lead={t.sake.lead}>
              <div lang="ja">
                <ProductGrid items={products} className="mt-12" />
              </div>
            </PhotoBand>
            <div className="mx-auto mt-10 flex max-w-6xl justify-end px-4 md:px-5">
              <MoreLink href={shopUrl("/")}>{t.sake.more}</MoreLink>
            </div>
          </section>
        )}

        {/* ご予約 */}
        <section id="reserve" className="bg-surface px-4 py-20 md:px-5 md:py-24">
          <SectionHeading en="RESERVATION" ja={t.reserve.title} />
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-3 md:grid-cols-3">
              {otaLinks.map((o) => {
                const name = t.reserve.otaNames[o.name] ?? o.name;
                return o.url ? (
                  <MoreLink key={o.name} href={o.url} className="w-full">
                    <span className="flex items-center gap-3">
                      <OtaIcon name={o.icon} className="text-green transition-colors group-hover:text-white" />
                      {fmt(t.reserve.otaBook, { name })}
                    </span>
                  </MoreLink>
                ) : (
                  <span key={o.name} className="flex items-center justify-between border border-line bg-white px-6 py-4 text-sm text-sub">
                    <span className="flex items-center gap-3">
                      <OtaIcon name={o.icon} className="text-sub/60" />
                      {name}
                    </span>
                    <span className="text-xs">{t.reserve.otaSoon}</span>
                  </span>
                );
              })}
            </div>

            <div className="mt-12 bg-white px-5 py-10 md:px-12">
              <h3 className="border-l-4 border-green pl-3 font-brush text-xl font-bold">{t.reserve.directTitle}</h3>
              <p className="mt-4 mb-8 text-sm leading-7 text-sub">{t.reserve.directBody}</p>
              <InquiryForm lang={lang} t={t.form} roomNames={t.rooms.names} />
            </div>
          </div>
        </section>

        {/* アクセス */}
        <section id="access" className="px-4 py-20 md:px-5 md:py-24">
          <SectionHeading en="ACCESS" ja={t.access.title} />
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-16">
            <dl className="grid content-start gap-y-6 text-[15px] md:grid-cols-[8rem_1fr]">
              <dt className="font-bold">{t.access.addressLabel}</dt>
              <dd className="leading-7">
                {t.access.address[0]}
                <br />
                {t.access.address[1]}
                <div className="mt-4">
                  <MoreLink href={site.gbpUrl}>{t.access.map}</MoreLink>
                </div>
              </dd>
              <dt className="font-bold">{t.access.nearestLabel}</dt>
              <dd className="leading-7">{t.access.nearest}</dd>
              <dt className="font-bold">{t.access.aroundLabel}</dt>
              <dd className="leading-7">{t.access.around}</dd>
            </dl>
            <iframe
              title={t.access.mapTitle}
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed&hl=${lang === "zh" ? "zh-CN" : lang}`}
              loading="lazy"
              className="aspect-[4/3] w-full border border-line"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      </main>

      <footer className="bg-surface px-4 pt-14 pb-10 md:px-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 text-[13px] md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <Crest className="size-14" />
            <div>
              <p lang="ja" className="font-serif-ja text-lg tracking-[0.2em]">
                {site.name}
              </p>
              <p className="mt-1 text-xs text-sub">
                {t.access.address[0]} {t.access.address[1]}
              </p>
            </div>
          </div>
          <p className="text-xs text-sub">
            {fmt(t.footer.operator, { company: site.company })}　© {new Date().getFullYear()} {site.roman}
          </p>
        </div>
      </footer>
    </>
  );
}
