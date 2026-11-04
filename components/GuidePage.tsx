import Link from "next/link";
import type { ReactNode } from "react";
import { guideDoc, guideLocales, guidePath, guideSlugs, guideUI, type Block, type GuideLocale, type GuideSlug } from "@/lib/guide";
import { intlPhone, site, telHref } from "@/lib/site";

/**
 * 滞在中のご案内。客室オーダー（order/）から開くページなので、HPの白×緑ではなく
 * 客室オーダーのトップと同じ青緑で揃える（色は order/public/app.css の :root と同じ値）。
 */
const C = {
  bg: "bg-[linear-gradient(180deg,#EAF2FD_0%,#EDF8F4_100%)]",
  surface: "bg-white shadow-[0_6px_20px_rgba(43,107,211,0.08)]",
  line: "border-[#E2EBF5]",
  divide: "divide-[#E2EBF5]",
  text: "text-[#1D2A3B]",
  muted: "text-[#536479]",
  accent: "text-[#2B6BD3]",
  accentBg: "bg-[linear-gradient(135deg,#2B6BD3_0%,#138A74_100%)]",
  sel: "bg-[#E3EEFC]",
  grad: "bg-[linear-gradient(135deg,#2B6BD3_0%,#138A74_100%)]",
  gradText: "bg-[linear-gradient(135deg,#2B6BD3_0%,#138A74_100%)] bg-clip-text text-transparent",
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
    <header className={`sticky top-0 z-10 rounded-b-[26px] ${C.grad} text-white shadow-[0_10px_26px_rgba(43,107,211,0.25)]`}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-4">
        <Link href={guidePath(lang)} className="flex min-w-0 items-center gap-2">
          <Moon className="size-7 shrink-0 text-white" />
          <span className="min-w-0 leading-tight">
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span lang="ja" className="font-serif text-[19px] font-semibold tracking-[0.08em]">
                {site.name}
              </span>
              <span className="hidden font-serif text-[11px] tracking-[0.12em] text-white/85 min-[440px]:inline">Sayozuki</span>
            </span>
            <span className="block truncate text-[11px] text-white/80">{ui.guide}</span>
          </span>
        </Link>
        <nav aria-label="Language" className="flex shrink-0 gap-0.5">
          {guideLocales.map((l) => (
            <Link
              key={l}
              href={guidePath(l, slug)}
              hrefLang={l === "zh" ? "zh-Hans" : l}
              aria-current={l === lang ? "true" : undefined}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] ${l === lang ? "bg-white font-bold text-[#2B6BD3]" : "text-white/85 hover:bg-white/15"}`}
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
  return <div className={`rounded-[22px] ${C.surface} ${className}`}>{children}</div>;
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
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${C.sel} font-serif text-[13px] ${C.accent}`}>Q</span>
                  <span className="flex-1">{it.q}</span>
                  <svg viewBox="0 0 12 12" className={`mt-1.5 size-3 shrink-0 ${C.muted} transition-transform group-open:rotate-180`} fill="none" stroke="currentColor" aria-hidden>
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                </summary>
                <p className="flex gap-3 px-4 pb-4 text-[15px] leading-relaxed">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#D9F2E8] font-serif text-[13px] text-[#145E4B]">A</span>
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
                <span className={`mt-[0.72em] size-1.5 shrink-0 rounded-full ${C.grad}`} aria-hidden />
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
            <li key={it} className={`rounded-full ${C.sel} px-3 py-1.5 text-[13px] font-medium ${C.accent}`}>
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
                <Link href={guidePath(lang, s)} className={`flex items-center justify-between gap-2 rounded-2xl ${C.surface} px-4 py-3.5 text-[14px] font-medium transition active:scale-[0.97] hover:text-[#2B6BD3]`}>
                  <span>{ui.nav[s]}</span>
                  <span aria-hidden className={C.accent}>→</span>
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      <div className={`mt-8 rounded-[22px] ${C.grad} p-5 text-[14px] leading-relaxed text-white shadow-[0_10px_26px_rgba(43,107,211,0.25)]`}>
        <p>{ui.orderNote}</p>
        <p className="mt-2">{ui.contact}</p>
        <p className="mt-3">
          <a href={telHref(site.tel)} className="inline-flex rounded-full bg-white px-4 py-2 text-base font-bold text-[#2B6BD3]">
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
      <h1 className={`mt-2 w-fit font-serif text-[26px] font-bold leading-snug tracking-[0.04em] md:text-3xl ${C.gradText}`}>{title}</h1>
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
              <Link key={s} href={guidePath(lang, s)} className={`flex items-center justify-between gap-4 rounded-[22px] ${C.surface} px-5 py-4 transition active:scale-[0.98]`}>
                <span>
                  <span className="block font-serif text-[16px] font-semibold">{d.title}</span>
                  <span className={`block text-[13px] ${C.muted}`}>{d.lead}</span>
                </span>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${C.grad} text-white`} aria-hidden>
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
