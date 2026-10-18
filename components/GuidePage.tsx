import Link from "next/link";
import { Crest } from "@/components/ui";
import { guideDoc, guideLocales, guidePath, guideSlugs, guideUI, type Block, type GuideLocale, type GuideSlug } from "@/lib/guide";
import { intlPhone, site, telHref } from "@/lib/site";

const LANG_LABEL: Record<GuideLocale, string> = { ja: "日本語", en: "EN", zh: "中文", ko: "한국어" };

function GuideHeader({ lang, slug }: { lang: GuideLocale; slug?: GuideSlug }) {
  const ui = guideUI[lang];
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href={guidePath(lang)} className="flex min-w-0 items-center gap-2.5">
          <Crest className="size-10 shrink-0" />
          <span className="min-w-0 leading-tight">
            <span lang="ja" className="block font-serif-ja text-base tracking-[0.2em]">
              {site.name}
            </span>
            <span className="block truncate text-[11px] text-sub">{ui.guide}</span>
          </span>
        </Link>
        <nav aria-label="Language" className="flex shrink-0 gap-0.5">
          {guideLocales.map((l) => (
            <Link
              key={l}
              href={guidePath(l, slug)}
              hrefLang={l === "zh" ? "zh-Hans" : l}
              aria-current={l === lang ? "true" : undefined}
              className={`whitespace-nowrap rounded-full px-2 py-1 text-[12px] ${l === lang ? "bg-green text-white" : "text-sub hover:text-green"}`}
            >
              {LANG_LABEL[l]}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Pending({ children }: { children: string }) {
  return <span className="text-sub">{children}</span>;
}

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "rows":
      return (
        <dl className="divide-y divide-line border-y border-line">
          {b.rows.map((r) => (
            <div key={r.k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-[15px] sm:grid-cols-[10rem_1fr]">
              <dt className="text-sub">{r.k}</dt>
              <dd className="font-medium">{r.pending ? <Pending>{r.v}</Pending> : r.v}</dd>
            </div>
          ))}
        </dl>
      );
    case "qa":
      return (
        <div className="divide-y divide-line border-y border-line">
          {b.items.map((it) => (
            <details key={it.q} className="group py-1" open>
              <summary className="flex cursor-pointer list-none items-start gap-3 py-3 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
                <span className="font-en text-green">Q</span>
                <span className="flex-1">{it.q}</span>
                <svg viewBox="0 0 12 12" className="mt-1.5 size-3 shrink-0 text-sub transition-transform group-open:rotate-180" fill="none" stroke="currentColor" aria-hidden>
                  <path d="M2 4l4 4 4-4" />
                </svg>
              </summary>
              <p className="flex gap-3 pb-4 text-[15px] leading-relaxed">
                <span className="font-en text-sub">A</span>
                <span className="flex-1">{it.a}</span>
              </p>
            </details>
          ))}
        </div>
      );
    case "list":
      return b.ordered ? (
        <ol className="space-y-3">
          {b.items.map((it, i) => (
            <li key={it} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-soft font-en text-[13px] text-green">{i + 1}</span>
              <span className="flex-1">{it}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2">
          {b.items.map((it) => (
            <li key={it} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-green" aria-hidden />
              <span className="flex-1">{it}</span>
            </li>
          ))}
        </ul>
      );
    case "tags":
      return (
        <ul className="flex flex-wrap gap-2">
          {b.items.map((it) => (
            <li key={it} className="bg-surface px-3 py-1.5 text-[13px]">
              {it}
            </li>
          ))}
        </ul>
      );
    case "spots":
      return (
        <ul className="space-y-3">
          {b.items.map((it) => (
            <li key={it.name} className="border border-line bg-white p-4">
              <p className="font-bold">{it.name}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-sub">{it.text}</p>
            </li>
          ))}
        </ul>
      );
    case "text":
      return <p className="text-[15px] leading-relaxed">{b.text}</p>;
  }
}

function GuideFooter({ lang, current }: { lang: GuideLocale; current?: GuideSlug }) {
  const ui = guideUI[lang];
  return (
    <footer className="mx-auto max-w-2xl px-4 pb-16">
      <nav aria-label={ui.guide} className="border-t border-line pt-8">
        <ul className="grid grid-cols-2 gap-2">
          {guideSlugs
            .filter((s) => s !== current)
            .map((s) => (
              <li key={s}>
                <Link href={guidePath(lang, s)} className="flex items-center justify-between gap-2 border border-line bg-white px-4 py-3 text-[14px] hover:border-green hover:text-green">
                  <span>{ui.nav[s]}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      <div className="mt-8 bg-green-soft p-5 text-[14px] leading-relaxed">
        <p>{ui.orderNote}</p>
        <p className="mt-2">{ui.contact}</p>
        <p className="mt-3">
          <a href={telHref(site.tel)} className="font-en text-base text-green underline-offset-4 hover:underline">
            {lang === "ja" ? site.tel : intlPhone(site.tel)}
          </a>
        </p>
      </div>
      <p lang="ja" className="mt-8 text-center font-serif-ja text-sm tracking-[0.2em] text-sub">
        {site.name}
      </p>
    </footer>
  );
}

/** /guide/[slug] の本文 */
export function GuidePage({ lang, slug }: { lang: GuideLocale; slug: GuideSlug }) {
  const doc = guideDoc(lang, slug);
  return (
    <>
      <GuideHeader lang={lang} slug={slug} />
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-10">
        <p className="font-en text-[12px] uppercase tracking-[0.3em] text-green">{doc.en}</p>
        <h1 className="mt-2 font-brush text-[26px] font-bold leading-snug md:text-3xl">{doc.title}</h1>
        <p className="mt-3 text-[14px] text-sub">{doc.lead}</p>
        <div className="mt-10 space-y-12">
          {doc.sections.map((s, i) => (
            <section key={s.heading || i}>
              {s.heading && <h2 className="mb-4 border-l-2 border-green pl-3 text-[17px] font-bold">{s.heading}</h2>}
              <div className="space-y-4">
                {s.blocks.map((b, j) => (
                  <BlockView key={j} b={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <GuideFooter lang={lang} current={slug} />
    </>
  );
}

/** /guide の目次 */
export function GuideIndex({ lang }: { lang: GuideLocale }) {
  const ui = guideUI[lang];
  return (
    <>
      <GuideHeader lang={lang} />
      <main className="mx-auto max-w-2xl px-4 pb-6 pt-10">
        <p className="font-en text-[12px] uppercase tracking-[0.3em] text-green">Guide</p>
        <h1 className="mt-2 font-brush text-[26px] font-bold md:text-3xl">{ui.guide}</h1>
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {guideSlugs.map((s) => {
            const d = guideDoc(lang, s);
            return (
              <li key={s}>
                <Link href={guidePath(lang, s)} className="flex items-center justify-between gap-4 py-4 hover:text-green">
                  <span>
                    <span className="block font-bold">{d.title}</span>
                    <span className="block text-[13px] text-sub">{d.lead}</span>
                  </span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <GuideFooter lang={lang} />
    </>
  );
}
