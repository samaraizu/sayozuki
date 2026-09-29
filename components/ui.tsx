import Link from "next/link";
import type { ReactNode } from "react";

/** 英字の大見出し＋日本語の小見出し（中央寄せ） */
export function SectionHeading({ en, ja, light = false }: { en: string; ja: string; light?: boolean }) {
  return (
    <div className="mb-12 text-center md:mb-14">
      <h2 className={`font-en text-[34px] font-medium leading-none md:text-[44px] ${light ? "text-white" : "text-ink"}`}>
        {en}
      </h2>
      <p className={`mt-4 text-sm font-bold ${light ? "text-white/90" : "text-ink"}`}>{ja}</p>
    </div>
  );
}

/** 枠線と長い矢印のリンクボタン */
export function MoreLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const external = href.startsWith("http");
  const cls = `group inline-flex min-w-56 items-center justify-between gap-8 border border-ink bg-white px-6 py-3.5 text-sm text-ink transition-colors hover:bg-ink hover:text-white ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      <svg viewBox="0 0 52 8" className="h-2 w-12 shrink-0" fill="none" stroke="currentColor" aria-hidden>
        <path d="M0 7h50L44 1" />
      </svg>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : href.startsWith("#") ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** 「#辛口」のようなタグ。右下の小さな三角は参考にした意匠 */
export function Chip({ href, children }: { href?: string; children: ReactNode }) {
  const cls =
    "relative inline-block bg-white px-3.5 py-1.5 text-[13px] text-ink shadow-sm transition-colors after:absolute after:bottom-0.5 after:right-0.5 after:border-4 after:border-transparent after:border-b-sub/50 after:border-r-sub/50 hover:bg-green hover:text-white";
  return href ? (
    <Link href={href} className={cls} scroll={false}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/** 全面写真の帯。見出しとタグを載せ、下の要素が帯に半分重なる */
export function PhotoBand({
  image,
  alt,
  title,
  lead,
  children,
}: {
  image: string;
  alt: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[360px] overflow-hidden md:h-[420px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 背景の飾りなので next/image の最適化は要らない */}
        <img src={image} alt={alt} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/35" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pt-16 text-center text-white md:pt-20">
        <h3 className="text-xl font-bold tracking-[0.06em] text-balance md:text-3xl">{title}</h3>
        {lead && <p className="mt-3 text-[13px] font-bold text-balance opacity-95 md:text-sm">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/** 小夜月の印。三日月と屋号 */
export function Crest({ className = "", tone = "green" }: { className?: string; tone?: "green" | "white" }) {
  const color = tone === "white" ? "#ffffff" : "#1f6a45";
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="小夜月">
      <circle cx="32" cy="32" r="30" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z" fill={color} opacity="0.18" />
      <text
        x="32"
        y="17"
        fill={color}
        fontSize="13"
        fontFamily="var(--font-shippori), serif"
        writingMode="vertical-rl"
        textAnchor="start"
        letterSpacing="1"
      >
        小夜月
      </text>
    </svg>
  );
}
