import Link from "next/link";
import type { ReactNode } from "react";
import { guideDoc, guideLocales, guidePath, guideSlugs, guideUI, type Block, type GuideLocale, type GuideSlug } from "@/lib/guide";
import { intlPhone, site, telHref } from "@/lib/site";

/**
 * 滞在中のご案内。客室オーダー（order/）から開くページなので、HPの白×緑ではなく
 * 客室オーダーと同じ和紙の生成り×藍で揃える（色は order/public/app.css と同じ値）。
 */
const C = {
  bg: "bg-[#F3EEE4]",
  surface: "bg-[#FFFCF6]",
  line: "border-[#E2D9C9]",
  divide: "divide-[#E2D9C9]",
  text: "text-[#1F1C17]",
  muted: "text-[#5F584D]",
  accent: "text-[#24456F]",
  accentBg: "bg-[#24456F]",
  sel: "bg-[#E3E9F1]",
};

const LANG_LABEL: Record<GuideLocale, string> = { ja: "日本語", en: "EN", zh: "中文", ko: "한국어" };

function Moon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className={`min-h-dvh ${C.bg} ${C.text}`}>{children}</div>;
}

function GuideHeader({ lang, slug }: { lang: GuideLocale; slug?: GuideSlug }) {
  const ui = guideUI[lang];
  return (
    <header className={`sticky top-0 z-10 border-b ${C.line} bg-[#F3EEE4]/95 backdrop-blur`}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href={guidePath(lang)} className="flex min-w-0 items-center gap-2">
          <Moon className={`size-7 shrink-0 ${C.accent}`} />
          <span className="min-w-0 leading-tight">
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span lang="ja" className="font-serif text-[19px] font-semibold tracking-[0.08em]">
                {site.name}
              </span>
              <span className={`font-serif text-[11px] tracking-[0.12em] ${C.accent}`}>Sayozuki</span>
            </span>
            <span className={`block truncate text-[11px] ${C.muted}`}>{ui.guide}</span>
          </span>
        </Link>
        <nav aria-label="Language" className="flex shrink-0 gap-0.5">
          {guideLocales.map((l) => (
            <Link
              key={l}
              href={guidePath(l, slug)}
              hrefLang={l === "zh" ? "zh-Hans" : l}
              aria-current={l === lang ? "true" : undefined}
              className={`whitespace-nowrap rounded-full px-2 py-1 text-[12px] ${l === lang ? `${C.accentBg} text-white` : `${C.muted} hover:text-[#24456F]`}`}
            >
              {LANG_LABEL[l]}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border ${C.line} ${C.surface} ${className}`}>{children}</div>;
}

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "rows":
      return (
        <Card className="px-4">
          <dl className={`divide-y ${C.divide}`}>
            {b.rows.map((r) => (
              <div key={r.k} className="grid grid-cols-[7rem_1fr] gap-3 py-3.5 text-[15px] sm:grid-cols-[9rem_1fr]">
                <dt className={C.muted}>{r.k}</dt>
                <dd className={r.pending ? C.muted : "font-medium"}>{r.v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      );
    case "qa":
      return (
        <div className="space-y-2.5">
          {b.items.map((it) => (
            <Card key={it.q}>
              <details className="group" open>
                <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
                  <span className={`font-serif ${C.accent}`}>問</span>
                  <span className="flex-1">{it.q}</span>
                  <svg viewBox="0 0 12 12" className={`mt-1.5 size-3 shrink-0 ${C.muted} transition-transform group-open:rotate-180`} fill="none" stroke="currentColor" aria-hidden>
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                </summary>
                <p className="flex gap-3 px-4 pb-4 text-[15px] leading-relaxed">
                  <span className={`font-serif ${C.muted}`}>答</span>
                  <span className="flex-1">{it.a}</span>
                </p>
              </details>
            </Card>
          ))}
        </div>
      );
    case "list":
      return b.ordered ? (
        <Card className="p-4">
          <ol className="space-y-3.5">
            {b.items.map((it, i) => (
              <li key={it} className="flex gap-3 text-[15px] leading-relaxed">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${C.accentBg} font-serif text-[13px] text-white`}>{i + 1}</span>
                <span className="flex-1">{it}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card className="p-4">
          <ul className="space-y-2.5">
            {b.items.map((it) => (
              <li key={it} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="mt-[0.72em] size-1.5 shrink-0 rounded-full bg-[#24456F]" aria-hidden />
                <span className="flex-1">{it}</span>
              </li>
            ))}
          </ul>
        </Card>
      );
    case "tags":
      return (
        <ul className="flex flex-wrap gap-2">
          {b.items.map((it) => (
            <li key={it} className={`rounded-full border ${C.line} ${C.surface} px-3 py-1.5 text-[13px]`}>
              {it}
            </li>
          ))}
        </ul>
      );
    case "spots":
      return (
        <div className="space-y-2.5">
          {b.items.map((it) => (
            <Card key={it.name} className="p-4">
              <p className="font-serif text-[16px] font-semibold">{it.name}</p>
              <p className={`mt-1 text-[14px] leading-relaxed ${C.muted}`}>{it.text}</p>
            </Card>
          ))}
        </div>
      );
    case "text":
      return <p className="text-[15px] leading-relaxed">{b.text}</p>;
  }
}

function GuideFooter({ lang, current }: { lang: GuideLocale; current?: GuideSlug }) {
  const ui = guideUI[lang];
  return (
    <footer className="mx-auto max-w-2xl px-4 pb-16">
      <nav aria-label={ui.guide} className={`border-t ${C.line} pt-8`}>
        <ul className="grid grid-cols-2 gap-2">
          {guideSlugs
            .filter((s) => s !== current)
            .map((s) => (
              <li key={s}>
                <Link href={guidePath(lang, s)} className={`flex items-center justify-between gap-2 rounded-xl border ${C.line} ${C.surface} px-4 py-3 text-[14px] hover:border-[#24456F] hover:text-[#24456F]`}>
                  <span>{ui.nav[s]}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      <div className={`mt-8 rounded-2xl ${C.sel} p-5 text-[14px] leading-relaxed`}>
        <p>{ui.orderNote}</p>
        <p className="mt-2">{ui.contact}</p>
        <p className="mt-3">
          <a href={telHref(site.tel)} className={`text-base font-medium ${C.accent} underline-offset-4 hover:underline`}>
            {lang === "ja" ? site.tel : intlPhone(site.tel)}
          </a>
        </p>
      </div>
      <p className={`mt-10 flex items-center justify-center gap-2 font-serif text-sm tracking-[0.2em] ${C.muted}`}>
        <Moon className={`size-4 ${C.accent}`} />
        <span lang="ja">{site.name}</span>
      </p>
    </footer>
  );
}

function Title({ en, title, lead }: { en: string; title: string; lead?: string }) {
  return (
    <>
      <p className={`font-serif text-[12px] uppercase tracking-[0.3em] ${C.accent}`}>{en}</p>
      <h1 className="mt-2 font-serif text-[26px] font-semibold leading-snug tracking-[0.04em] md:text-3xl">{title}</h1>
      {lead && <p className={`mt-3 text-[14px] ${C.muted}`}>{lead}</p>}
    </>
  );
}

/** /guide/[slug] の本文 */
export function GuidePage({ lang, slug }: { lang: GuideLocale; slug: GuideSlug }) {
  const doc = guideDoc(lang, slug);
  return (
    <Shell>
      <GuideHeader lang={lang} slug={slug} />
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-9">
        <Title en={doc.en} title={doc.title} lead={doc.lead} />
        <div className="mt-9 space-y-10">
          {doc.sections.map((s, i) => (
            <section key={s.heading || i}>
              {s.heading && <h2 className="mb-3 font-serif text-[18px] font-semibold tracking-[0.04em]">{s.heading}</h2>}
              <div className="space-y-3">
                {s.blocks.map((b, j) => (
                  <BlockView key={j} b={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <GuideFooter lang={lang} current={slug} />
    </Shell>
  );
}

/** /guide の目次 */
export function GuideIndex({ lang }: { lang: GuideLocale }) {
  const ui = guideUI[lang];
  return (
    <Shell>
      <GuideHeader lang={lang} />
      <main className="mx-auto max-w-2xl px-4 pb-6 pt-9">
        <Title en="Guide" title={ui.guide} />
        <div className="mt-8 space-y-2.5">
          {guideSlugs.map((s) => {
            const d = guideDoc(lang, s);
            return (
              <Link key={s} href={guidePath(lang, s)} className={`flex items-center justify-between gap-4 rounded-2xl border ${C.line} ${C.surface} px-4 py-4 hover:border-[#24456F]`}>
                <span>
                  <span className="block font-serif text-[16px] font-semibold">{d.title}</span>
                  <span className={`block text-[13px] ${C.muted}`}>{d.lead}</span>
                </span>
                <span className={C.accent} aria-hidden>
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </main>
      <GuideFooter lang={lang} />
    </Shell>
  );
}
