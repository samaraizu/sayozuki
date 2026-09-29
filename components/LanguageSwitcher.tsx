import Link from "next/link";
import { dictionaries, locales, pathFor, type Locale } from "@/lib/i18n";

/** JS なしでも開閉できるよう <details> で作る */
export function LanguageSwitcher({ lang }: { lang: Locale }) {
  return (
    <details className="group relative">
      <summary
        aria-label={dictionaries[lang].nav.language}
        className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-[12px] tracking-[0.1em] opacity-80 hover:opacity-100 [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
        {lang.toUpperCase()}
      </summary>
      <ul className="absolute right-0 top-full mt-2 min-w-40 bg-ink py-2 shadow-lg ring-1 ring-washi/10">
        {locales.map((l) => (
          <li key={l}>
            <Link
              href={pathFor(l)}
              hrefLang={l}
              lang={l}
              aria-current={l === lang ? "page" : undefined}
              className="block px-5 py-2.5 text-[13px] text-washi/80 hover:bg-washi/10 hover:text-washi aria-[current=page]:text-moon"
            >
              {dictionaries[l].label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
