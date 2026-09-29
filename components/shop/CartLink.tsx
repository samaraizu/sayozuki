"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/shop/cart"
      className="flex items-center gap-2 border border-washi/40 px-4 py-2 text-[12px] tracking-[0.2em] transition-colors hover:bg-washi hover:text-ink"
    >
      カート
      <span className="min-w-5 bg-moon px-1.5 text-center text-[11px] tracking-normal text-washi tabular-nums">
        {count}
      </span>
    </Link>
  );
}
