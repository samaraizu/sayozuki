import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Photo } from "@/components/Photo";
import { dictionaries, fmt, formatYen, type Locale } from "@/lib/i18n";
import { meals, otaLinks, photos, rooms, site } from "@/lib/site";

function SectionTitle({ en, title }: { en: string; title: string }) {
  return (
    <div className="mb-12 md:mb-16">
      <p className="text-[11px] tracking-[0.4em] text-moon">{en}</p>
      <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">{title}</h2>
    </div>
  );
}

/** 宿のトップページ。言語ごとに文言だけ差し替える */
export function InnPage({ lang }: { lang: Locale }) {
  const t = dictionaries[lang];
  const yen = (n: number) => formatYen(lang, n);
  const roomName = (name: string) => t.rooms.names[name] ?? name;
  const mapQuery = encodeURIComponent(`${site.address} ${site.name}`);

  const nav = [
    ["about", t.nav.about],
    ["onsen", t.nav.onsen],
    ["rooms", t.nav.rooms],
    ["price", t.nav.price],
    ["access", t.nav.access],
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
      <header className="fixed inset-x-0 top-0 z-50 bg-ink/80 text-washi backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <a href="#top" className="shrink-0 font-serif text-lg tracking-[0.3em]">
            {site.name}
          </a>
          <nav className="ml-auto hidden items-center gap-7 text-[13px] tracking-[0.12em] lg:flex">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="opacity-80 transition-opacity hover:opacity-100">
                {label}
              </a>
            ))}
            <Link href="/shop" hrefLang="ja" className="text-moon transition-opacity hover:opacity-80">
              {t.nav.shop}
            </Link>
          </nav>
          <Link
            href="/shop"
            hrefLang="ja"
            className="ml-auto truncate text-[12px] tracking-[0.1em] text-moon lg:hidden"
          >
            {lang === "ja" ? t.nav.shop : "SAKE"}
          </Link>
          <LanguageSwitcher lang={lang} />
          <a
            href="#reserve"
            className="shrink-0 border border-washi/40 px-4 py-2 text-[12px] tracking-[0.15em] transition-colors hover:bg-washi hover:text-ink"
          >
            {t.nav.reserve}
          </a>
        </div>
      </header>

      <main id="top">
        {/* ファーストビュー */}
        <section className="relative flex h-[100svh] min-h-[560px] items-center justify-center bg-ink text-washi">
          <div className="absolute inset-0">
            <Photo src={photos.hero} alt={t.hero.alt} priority className="h-full" />
          </div>
          <div className="absolute inset-0 bg-ink/55" />
          <div className="relative flex flex-col items-center">
            <h1 lang="ja" className="vertical font-serif-ja text-5xl tracking-[0.5em] md:text-6xl">
              {site.name}
            </h1>
            <p className="mt-8 text-[11px] tracking-[0.5em] opacity-80">{site.roman}</p>
          </div>
          <p className="absolute bottom-8 px-5 text-center text-[12px] tracking-[0.3em] opacity-70">
            {t.hero.tagline}
          </p>
        </section>

        {/* 小夜月について */}
        <section id="about" className="mx-auto max-w-6xl px-5 py-24 md:py-36">
          <div className="grid items-center gap-12 md:grid-cols-[1fr_1.2fr] md:gap-20">
            <div>
              <SectionTitle en="CONCEPT" title={t.about.title} />
              <p className="font-serif text-xl leading-[2.2] tracking-[0.1em] md:text-2xl">
                {t.about.lead[0]}
                <br />
                {t.about.lead[1]}
              </p>
              <div className="mt-10 space-y-6 text-[15px] leading-[2.2] text-ink/75">
                {t.about.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4">
              <Photo src={photos.lobby} alt={t.about.altLobby} sizes="(min-width: 768px) 30vw, 60vw" className="col-span-3 aspect-[3/4]" />
              <Photo src={photos.noren} alt={t.about.altNoren} sizes="(min-width: 768px) 20vw, 40vw" className="col-span-2 mt-16 aspect-[3/4]" />
            </div>
          </div>
        </section>

        {/* 温泉 */}
        <section id="onsen" className="bg-ink text-washi">
          <div className="grid md:grid-cols-2">
            <Photo src={photos.onsen} alt={t.onsen.alt} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] md:aspect-auto md:min-h-[640px]" />
            <div className="px-5 py-20 md:px-16 md:py-28">
              <div className="mb-12">
                <p className="text-[11px] tracking-[0.4em] text-moon">HOT SPRING</p>
                <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">{t.onsen.title}</h2>
              </div>
              <p className="text-[15px] leading-[2.2] text-washi/75">{t.onsen.body}</p>
              <dl className="mt-12 space-y-8 border-t border-washi/15 pt-10 text-sm">
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">{t.onsen.qualityLabel}</dt>
                  <dd className="mt-2 leading-7">{t.onsen.quality}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">{t.onsen.benefitsLabel}</dt>
                  <dd className="mt-3 flex flex-wrap gap-2">
                    {t.onsen.benefits.map((b) => (
                      <span key={b} className="border border-washi/20 px-3 py-1 text-[12px] text-washi/80">
                        {b}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* 客室 */}
        <section id="rooms" className="mx-auto max-w-6xl px-5 py-24 md:py-36">
          <SectionTitle en="ROOMS" title={t.rooms.title} />
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <Photo src={photos.room} alt={t.rooms.altRoom} sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10]" />
            <Photo src={photos.corridor} alt={t.rooms.altCorridor} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[16/10] md:aspect-auto" />
          </div>
          <p className="mt-12 max-w-2xl text-[15px] leading-[2.2] text-ink/75">
            {fmt(t.rooms.body, { n: rooms.length })}
          </p>
          <ul className="mt-12 grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <li key={r.name} className="bg-washi px-6 py-7">
                <p className="font-serif text-lg tracking-[0.1em]">{roomName(r.name)}</p>
                <p className="mt-2 text-sm text-ink/60">
                  {fmt(t.rooms.capacity, { n: r.capacity })}
                  {r.note && `　${t.rooms.familyNote}`}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ご料金 */}
        <section id="price" className="bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-24 md:py-36">
            <SectionTitle en="PRICE" title={t.price.title} />
            <div className="grid gap-12 md:grid-cols-[1.4fr_1fr] md:gap-20">
              <div>
                <table className="w-full text-[15px]">
                  <caption className="mb-4 text-left text-xs tracking-[0.1em] text-ink/60">{t.price.caption}</caption>
                  <thead className="sr-only">
                    <tr>
                      <th>{t.price.thRoom}</th>
                      <th>{t.price.thCapacity}</th>
                      <th>{t.price.thPrice}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rooms]
                      .sort((a, b) => b.price - a.price)
                      .map((r) => (
                        <tr key={r.name} className="border-b border-ink/15">
                          <th scope="row" className="py-4 text-left font-serif font-normal">
                            {roomName(r.name)}
                          </th>
                          <td className="py-4 text-sm text-ink/60">{fmt(t.price.upTo, { n: r.capacity })}</td>
                          <td className="py-4 text-right tabular-nums">{yen(r.price)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <ul className="mt-6 space-y-1.5 text-xs leading-6 text-ink/60">
                  {t.price.notes.map((n) => (
                    <li key={n}>※ {n}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-serif text-lg tracking-[0.15em]">{t.price.mealsTitle}</h3>
                {photos.meal && (
                  <Photo src={photos.meal} alt={t.price.altMeal} sizes="(min-width: 768px) 33vw, 100vw" className="mt-6 aspect-[4/3]" />
                )}
                <dl className="mt-6 text-[15px]">
                  <div className="flex justify-between gap-4 border-b border-ink/15 py-4">
                    <dt>{t.price.breakfast}</dt>
                    <dd className="tabular-nums">{fmt(t.price.perPerson, { price: yen(meals.breakfast) })}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-ink/15 py-4">
                    <dt>{t.price.dinner}</dt>
                    <dd className="tabular-nums">{fmt(t.price.perPerson, { price: yen(meals.dinner) })}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-6 text-ink/60">{t.price.mealsNote}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ご予約 */}
        <section id="reserve" className="mx-auto max-w-4xl px-5 py-24 md:py-36">
          <SectionTitle en="RESERVATION" title={t.reserve.title} />
          <div className="grid gap-4 sm:grid-cols-2">
            {otaLinks.map((o) => {
              const name = t.reserve.otaNames[o.name] ?? o.name;
              return o.url ? (
                <a
                  key={o.name}
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between border border-ink px-6 py-5 text-sm tracking-[0.1em] transition-colors hover:bg-ink hover:text-washi"
                >
                  {fmt(t.reserve.otaBook, { name })}
                  <span aria-hidden>→</span>
                </a>
              ) : (
                <span
                  key={o.name}
                  className="flex items-center justify-between border border-ink/20 px-6 py-5 text-sm tracking-[0.1em] text-ink/40"
                >
                  {name}
                  <span className="text-xs">{t.reserve.otaSoon}</span>
                </span>
              );
            })}
          </div>

          <div className="mt-20">
            <h3 className="font-serif text-lg tracking-[0.15em]">{t.reserve.directTitle}</h3>
            <p className="mt-4 mb-10 text-sm leading-7 text-ink/65">{t.reserve.directBody}</p>
            <InquiryForm lang={lang} t={t.form} roomNames={t.rooms.names} />
          </div>
        </section>

        {/* アクセス */}
        <section id="access" className="bg-ink text-washi">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2 md:gap-20 md:py-32">
            <div>
              <div className="mb-12">
                <p className="text-[11px] tracking-[0.4em] text-moon">ACCESS</p>
                <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">{t.access.title}</h2>
              </div>
              <dl className="space-y-8 text-[15px]">
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">{t.access.addressLabel}</dt>
                  <dd className="mt-2 leading-7">
                    {t.access.address[0]}
                    <br />
                    {t.access.address[1]}
                  </dd>
                  <dd className="mt-4">
                    <a
                      href={site.gbpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 border border-washi/30 px-5 py-3 text-[13px] tracking-[0.1em] transition-colors hover:bg-washi hover:text-ink"
                    >
                      {t.access.map}
                      <span aria-hidden>→</span>
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">{t.access.nearestLabel}</dt>
                  <dd className="mt-2 leading-7">{t.access.nearest}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">{t.access.aroundLabel}</dt>
                  <dd className="mt-2 leading-7">{t.access.around}</dd>
                </div>
              </dl>
            </div>
            <iframe
              title={t.access.mapTitle}
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed&hl=${lang === "zh" ? "zh-CN" : lang}`}
              loading="lazy"
              className="aspect-[4/3] w-full grayscale"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      </main>

      <footer className="bg-ink px-5 pb-10 text-washi/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-washi/10 pt-10 text-xs tracking-[0.1em] md:flex-row md:items-end md:justify-between">
          <div>
            <p lang="ja" className="font-serif-ja text-base tracking-[0.3em] text-washi">
              {site.name}
            </p>
            <p className="mt-3">
              {t.access.address[0]} {t.access.address[1]}
            </p>
          </div>
          <p>
            {fmt(t.footer.operator, { company: site.company })}　© {new Date().getFullYear()} {site.roman}
          </p>
        </div>
      </footer>
    </>
  );
}
