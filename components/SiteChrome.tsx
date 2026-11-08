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
 * 宿のHPのヘッダー。生成りの地に、苔色の丸い屋号印。
 * 画面上に追従し、半透明＋ぼかしで下の写真や帯が透けて見える
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
    <header className="sticky top-0 z-40 border-b border-frost/70 bg-cream/70 text-navy backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-4 pb-3 md:px-6 md:py-5">
        <a href={onTop ? "#top" : home} className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-full bg-sea text-cream">
            <Moon className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span lang="ja" className="font-mincho text-[22px] font-bold tracking-[0.16em]">
              {site.name}
            </span>
            <span className="text-[10px] tracking-[0.18em] text-slate">{site.roman}</span>
          </span>
        </a>
        <div className="flex items-center gap-2 md:order-2">
          <LanguageSwitcher lang={lang} sub={sub} />
          <a
            href={onTop ? "#reserve" : `${localePath(lang)}#reserve`}
            className="flex h-10 items-center rounded-xl bg-sea px-4 text-[13px] font-bold text-cream transition-colors hover:bg-sea-deep md:px-5 md:text-[14px]"
          >
            {t.book.navLabel}
          </a>
        </div>
        <nav aria-label="Main" className="-mx-1 w-full overflow-x-auto md:order-1 md:mx-0 md:ml-auto md:w-auto">
          <ul className="flex gap-1 whitespace-nowrap text-[13px] md:text-[14px]">
            {nav.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="flex h-9 items-center rounded-full px-3 font-medium text-navy hover:bg-kinari">
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
    <footer className="mt-24 rounded-t-[32px] bg-navy px-4 pt-12 pb-10 text-[#D6CFC2] md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-[13px] md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3">
          <Moon className="mt-1 size-6 text-wood" />
          <div>
            <p lang="ja" className="font-mincho text-xl font-bold tracking-[0.16em] text-cream">
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

/** 見出し（檜色の小さな英字ラベル＋明朝の見出し） */
export function Heading({ en, ja, lead, center = false }: { en: string; ja: string; lead?: string; center?: boolean }) {
  return (
    <div className={`mb-8 flex flex-col gap-2 md:mb-10 ${center ? "items-center text-center" : ""}`}>
      <p className="text-[12px] font-bold tracking-[0.24em] text-teal">{en}</p>
      <h2 className="font-mincho text-[26px] font-bold leading-snug md:text-[32px]">{ja}</h2>
      {lead && <p className="max-w-2xl text-[15px] leading-8 text-slate">{lead}</p>}
    </div>
  );
}
