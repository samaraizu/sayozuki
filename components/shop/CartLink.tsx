"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

/** ヘッダーのカートアイコン。入っている本数を右上に出す */
export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/shop/cart" className="relative flex flex-col items-center gap-0.5 px-2 text-[10px] text-ink" aria-label={`カート（${count}本）`}>
      <svg viewBox="0 0 32 28" className="h-7 w-8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M1 2h4l3.5 16h17L29 7H8" />
        <circle cx="11" cy="23.5" r="2" />
        <circle cx="23" cy="23.5" r="2" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 right-0 min-w-4 rounded-full bg-green px-1 text-center text-[10px] leading-4 text-white tabular-nums">
          {count}
        </span>
      )}
      <span className="hidden md:block">カート</span>
    </Link>
  );
}
