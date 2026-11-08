import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { dictionaries, fmt, localePath, type Locale } from "@/lib/i18n";
import { intlPhone, site, telHref } from "@/lib/site";

/** 三日月。客室オーダーのロゴと同じ形 */
export function Moon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

/**
 * 宿のHPのヘッダー。客室オーダーと同じ、青→青緑のグラデーションで下の角を丸めた帯。
 * onTop：トップページの中なら #about などのページ内リンク、ほかのページからはトップへ戻るリンクにする
 */
export function SiteHeader({ lang, onTop = false, sub = "" }: { lang: Locale; onTop?: boolean; sub?: string }) {
  const t = dictionaries[lang];
  const home = localePath(lang);
  const at = (hash: string) => (onTop ? hash : `${home}${hash}`);
  const nav = [
    [at("#about"), t.nav.about],
    [at("#onsen"), t.nav.onsen],
    [at("#rooms"), t.nav.rooms],
    [at("#price"), t.nav.price],
    [at("#access"), t.nav.access],
  ] as const;
  return (
    <header className="relative z-40 rounded-b-[28px] bg-grad text-white shadow-[0_10px_26px_rgba(43,107,211,0.22)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4 pb-3 md:px-6 md:py-5">
        <a href={onTop ? "#top" : home} className="flex items-center gap-2.5">
          <Moon className="size-6" />
          <span lang="ja" className="font-serif text-[22px] font-semibold tracking-[0.14em] leading-none">
            {site.name}
          </span>
          <span className="hidden font-serif text-[11px] tracking-[0.22em] text-white/90 sm:inline">{site.roman}</span>
        </a>
        <div className="flex items-center gap-2 md:order-2">
          <LanguageSwitcher lang={lang} sub={sub} />
          <a
            href={onTop ? "#reserve" : `${localePath(lang)}#reserve`}
            className="flex h-10 items-center rounded-full bg-white px-4 text-[13px] font-bold text-sea-deep transition-transform hover:scale-[1.03] md:px-5 md:text-[14px]"
          >
            {t.book.navLabel}
          </a>
        </div>
        <nav aria-label="Main" className="-mx-1 w-full overflow-x-auto md:order-1 md:mx-0 md:ml-auto md:w-auto">
          <ul className="flex gap-1 whitespace-nowrap text-[13px] md:text-[14px]">
            {nav.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="flex h-9 items-center rounded-full px-3 font-medium text-white/95 hover:bg-white/15">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ lang }: { lang: Locale }) {
  const t = dictionaries[lang];
  const phone = (n: string) => (lang === "ja" ? n : intlPhone(n));
  return (
    <footer className="mt-20 rounded-t-[28px] bg-navy px-4 pt-12 pb-10 text-[#C9D4E2] md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-[13px] md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <Moon className="mt-1 size-6 text-white" />
          <div>
            <p lang="ja" className="font-serif text-xl font-semibold tracking-[0.14em] text-white">
              {site.name}
            </p>
            <p className="mt-2 text-xs">
              {t.access.address[0]} {t.access.address[1]}
            </p>
            <p className="mt-1 text-xs">
              TEL{" "}
              <a href={telHref(site.tel)} className="hover:underline">
                {phone(site.tel)}
              </a>
              　FAX {phone(site.fax)}
            </p>
          </div>
        </div>
        <p className="text-xs">
          {fmt(t.footer.operator, { company: site.company })}　© {new Date().getFullYear()} {site.roman}
        </p>
      </div>
    </footer>
  );
}

/** 見出し（英字の小さなラベル＋明朝の見出し） */
export function Heading({ en, ja, lead, center = false }: { en: string; ja: string; lead?: string; center?: boolean }) {
  return (
    <div className={`mb-8 flex flex-col gap-2 md:mb-10 ${center ? "items-center text-center" : ""}`}>
      <p className="font-serif text-[13px] tracking-[0.24em] text-sea">{en}</p>
      <h2 className="font-serif text-[26px] font-semibold leading-snug md:text-[30px]">{ja}</h2>
      {lead && <p className="max-w-2xl text-[15px] leading-8 text-slate">{lead}</p>}
    </div>
  );
}
