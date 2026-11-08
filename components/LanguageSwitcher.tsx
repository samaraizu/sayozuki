import Link from "next/link";
import { dictionaries, localePath, locales, type Locale } from "@/lib/i18n";

/** JS なしでも開閉できるよう <details> で作る。sub は言語を変えても残すパス（/reserve など） */
export function LanguageSwitcher({ lang, sub = "" }: { lang: Locale; sub?: string }) {
  return (
    <details className="group relative">
      <summary
        aria-label={dictionaries[lang].nav.language}
        className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-frost bg-white px-3 text-[13px] font-medium text-navy hover:bg-kinari [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
        {lang.toUpperCase()}
      </summary>
      <ul className="absolute right-0 top-full z-50 mt-2 min-w-44 overflow-hidden rounded-2xl bg-white py-2 text-navy shadow-lift">
        {locales.map((l) => (
          <li key={l}>
            <Link
              href={localePath(l, sub)}
              hrefLang={l}
              lang={l}
              aria-current={l === lang ? "page" : undefined}
              className="block px-5 py-2.5 text-[14px] hover:bg-sky aria-[current=page]:bg-sel aria-[current=page]:font-bold"
            >
              {dictionaries[l].label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
