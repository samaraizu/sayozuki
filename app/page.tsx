import { InquiryForm } from "@/components/InquiryForm";
import { Photo } from "@/components/Photo";
import { meals, onsen, otaLinks, photos, pricingNotes, rooms, site, yen } from "@/lib/site";

const nav = [
  ["about", "小夜月について"],
  ["onsen", "温泉"],
  ["rooms", "客室"],
  ["price", "ご料金"],
  ["access", "アクセス"],
] as const;

function SectionTitle({ en, ja }: { en: string; ja: string }) {
  return (
    <div className="mb-12 md:mb-16">
      <p className="text-[11px] tracking-[0.4em] text-moon">{en}</p>
      <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">{ja}</h2>
    </div>
  );
}

export default function Home() {
  const mapQuery = encodeURIComponent(`${site.address} ${site.name}`);

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
    priceRange: `${yen(Math.min(...rooms.map((r) => r.price)))}〜`,
    sameAs: [site.gbpUrl],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="fixed inset-x-0 top-0 z-50 bg-ink/80 text-washi backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="font-serif text-lg tracking-[0.3em]">
            {site.name}
          </a>
          <nav className="hidden gap-8 text-[13px] tracking-[0.15em] md:flex">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="opacity-80 transition-opacity hover:opacity-100">
                {label}
              </a>
            ))}
          </nav>
          <a
            href="#reserve"
            className="border border-washi/40 px-4 py-2 text-[12px] tracking-[0.25em] transition-colors hover:bg-washi hover:text-ink"
          >
            ご予約
          </a>
        </div>
      </header>

      <main id="top">
        {/* ファーストビュー */}
        <section className="relative flex h-[100svh] min-h-[560px] items-center justify-center bg-ink text-washi">
          <div className="absolute inset-0">
            <Photo src={photos.hero} alt="岩組みの内湯" priority className="h-full" />
          </div>
          <div className="absolute inset-0 bg-ink/55" />
          <div className="relative flex flex-col items-center">
            <h1 className="vertical font-serif text-5xl tracking-[0.5em] md:text-6xl">{site.name}</h1>
            <p className="mt-8 text-[11px] tracking-[0.5em] opacity-80">{site.roman}</p>
          </div>
          <p className="absolute bottom-8 text-[12px] tracking-[0.3em] opacity-70">{site.tagline}</p>
        </section>

        {/* 小夜月について */}
        <section id="about" className="mx-auto max-w-6xl px-5 py-24 md:py-36">
          <div className="grid items-center gap-12 md:grid-cols-[1fr_1.2fr] md:gap-20">
            <div>
              <SectionTitle en="CONCEPT" ja="小夜月について" />
              <p className="font-serif text-xl leading-[2.2] tracking-[0.1em] md:text-2xl">
                月の出を待つような、
                <br />
                しずかな夜を。
              </p>
              <div className="mt-10 space-y-6 text-[15px] leading-[2.2] text-ink/75">
                <p>
                  山形・かみのやま温泉。蔵王のふもと、城下の湯の町に、小さな宿「小夜月」はあります。
                </p>
                <p>
                  にぎやかな演出はありません。湯に浸かり、窓の外の気配に耳を澄ませ、ただ何もしない時間を過ごす。そのための余白を、ご用意しました。
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4">
              <Photo src={photos.lobby} alt="ロビー" sizes="(min-width: 768px) 30vw, 60vw" className="col-span-3 aspect-[3/4]" />
              <Photo src={photos.noren} alt="湯ののれん" sizes="(min-width: 768px) 20vw, 40vw" className="col-span-2 mt-16 aspect-[3/4]" />
            </div>
          </div>
        </section>

        {/* 温泉 */}
        <section id="onsen" className="bg-ink text-washi">
          <div className="grid md:grid-cols-2">
            <Photo src={photos.onsen} alt="大浴場" sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] md:aspect-auto md:min-h-[640px]" />
            <div className="px-5 py-20 md:px-16 md:py-28">
              <div className="mb-12">
                <p className="text-[11px] tracking-[0.4em] text-moon">HOT SPRING</p>
                <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">温泉</h2>
              </div>
              <p className="text-[15px] leading-[2.2] text-washi/75">
                開湯五百年余りといわれる、かみのやま温泉。塩化物と硫酸塩を含むやわらかな湯は、よく温まり、湯上がりまでぬくもりが続きます。
              </p>
              <dl className="mt-12 space-y-8 border-t border-washi/15 pt-10 text-sm">
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">泉質</dt>
                  <dd className="mt-2 leading-7">{onsen.quality}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">効能</dt>
                  <dd className="mt-3 flex flex-wrap gap-2">
                    {onsen.benefits.map((b) => (
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
          <SectionTitle en="ROOMS" ja="客室" />
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <Photo src={photos.room} alt="和室の客室" sizes="(min-width: 768px) 66vw, 100vw" className="aspect-[16/10]" />
            <Photo src={photos.corridor} alt="館内の廊下" sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[16/10] md:aspect-auto" />
          </div>
          <p className="mt-12 max-w-2xl text-[15px] leading-[2.2] text-ink/75">
            客室は全{rooms.length}室。おふたりで過ごす小さな部屋から、ご家族やお仲間と囲める広めの部屋まで。山の名を冠した「蔵王」「月山」もございます。
          </p>
          <ul className="mt-12 grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <li key={r.name} className="bg-washi px-6 py-7">
                <p className="font-serif text-lg tracking-[0.1em]">{r.name}</p>
                <p className="mt-2 text-sm text-ink/60">
                  定員 {r.capacity}名{r.note && `　${r.note}`}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ご料金 */}
        <section id="price" className="bg-paper">
          <div className="mx-auto max-w-6xl px-5 py-24 md:py-36">
            <SectionTitle en="PRICE" ja="ご料金" />
            <div className="grid gap-12 md:grid-cols-[1.4fr_1fr] md:gap-20">
              <div>
                <table className="w-full text-[15px]">
                  <caption className="mb-4 text-left text-xs tracking-[0.15em] text-ink/60">
                    素泊まり・2名様1室あたり（税込）
                  </caption>
                  <thead className="sr-only">
                    <tr>
                      <th>客室</th>
                      <th>定員</th>
                      <th>料金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rooms]
                      .sort((a, b) => b.price - a.price)
                      .map((r) => (
                        <tr key={r.name} className="border-b border-ink/15">
                          <th scope="row" className="py-4 text-left font-serif font-normal">
                            {r.name}
                          </th>
                          <td className="py-4 text-sm text-ink/60">〜{r.capacity}名</td>
                          <td className="py-4 text-right tabular-nums">{yen(r.price)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <ul className="mt-6 space-y-1.5 text-xs leading-6 text-ink/60">
                  {pricingNotes.map((n) => (
                    <li key={n}>※{n}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-serif text-lg tracking-[0.15em]">お食事</h3>
                {photos.meal && (
                  <Photo src={photos.meal} alt="料理" sizes="(min-width: 768px) 33vw, 100vw" className="mt-6 aspect-[4/3]" />
                )}
                <dl className="mt-6 text-[15px]">
                  <div className="flex justify-between border-b border-ink/15 py-4">
                    <dt>朝食</dt>
                    <dd className="tabular-nums">お一人様 +{yen(meals.breakfast)}</dd>
                  </div>
                  <div className="flex justify-between border-b border-ink/15 py-4">
                    <dt>夕食</dt>
                    <dd className="tabular-nums">お一人様 +{yen(meals.dinner)}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-6 text-ink/60">
                  素泊まりに、朝食・夕食をお好みで組み合わせていただけます。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ご予約 */}
        <section id="reserve" className="mx-auto max-w-4xl px-5 py-24 md:py-36">
          <SectionTitle en="RESERVATION" ja="ご予約" />
          <div className="grid gap-4 sm:grid-cols-2">
            {otaLinks.map((o) =>
              o.url ? (
                <a
                  key={o.name}
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between border border-ink px-6 py-5 text-sm tracking-[0.15em] transition-colors hover:bg-ink hover:text-washi"
                >
                  {o.name}で予約する
                  <span aria-hidden>→</span>
                </a>
              ) : (
                <span
                  key={o.name}
                  className="flex items-center justify-between border border-ink/20 px-6 py-5 text-sm tracking-[0.15em] text-ink/40"
                >
                  {o.name}
                  <span className="text-xs">掲載準備中</span>
                </span>
              ),
            )}
          </div>

          <div className="mt-20">
            <h3 className="font-serif text-lg tracking-[0.15em]">宿へ直接のお問い合わせ</h3>
            <p className="mt-4 mb-10 text-sm leading-7 text-ink/65">
              日程やお部屋のご希望、お食事のご相談などはこちらから。{site.openDays}。
            </p>
            <InquiryForm />
          </div>
        </section>

        {/* アクセス */}
        <section id="access" className="bg-ink text-washi">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2 md:gap-20 md:py-32">
            <div>
              <div className="mb-12">
                <p className="text-[11px] tracking-[0.4em] text-moon">ACCESS</p>
                <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">アクセス</h2>
              </div>
              <dl className="space-y-8 text-[15px]">
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">所在地</dt>
                  <dd className="mt-2 leading-7">
                    {site.postalCode}
                    <br />
                    {site.address}
                  </dd>
                  <dd className="mt-4">
                    <a
                      href={site.gbpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 border border-washi/30 px-5 py-3 text-[13px] tracking-[0.15em] transition-colors hover:bg-washi hover:text-ink"
                    >
                      Google マップで見る
                      <span aria-hidden>→</span>
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">最寄り</dt>
                  <dd className="mt-2 leading-7">かみのやま温泉駅（JR山形新幹線・奥羽本線）</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.3em] text-moon">周辺</dt>
                  <dd className="mt-2 leading-7">蔵王温泉・上山城・武家屋敷通り</dd>
                </div>
              </dl>
            </div>
            <iframe
              title="小夜月の地図"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
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
            <p className="font-serif text-base tracking-[0.3em] text-washi">{site.name}</p>
            <p className="mt-3">
              {site.postalCode} {site.address}
            </p>
          </div>
          <p>
            運営：{site.company}　© {new Date().getFullYear()} {site.roman}
          </p>
        </div>
      </footer>
    </>
  );
}
