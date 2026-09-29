"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart, useCart } from "@/lib/cart";
import { shop } from "@/lib/shop";

export function AddToCart({ id }: { id: string }) {
  const { cart } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const inCart = cart[id] ?? 0;
  const room = shop.maxQty - inCart;

  return (
    <div>
      <div className="flex gap-3">
        <label className="sr-only" htmlFor="qty">
          本数
        </label>
        <select
          id="qty"
          value={Math.min(qty, Math.max(room, 1))}
          onChange={(e) => setQty(Number(e.target.value))}
          disabled={room <= 0}
          className="border border-ink/25 bg-transparent px-4 py-4 text-sm"
        >
          {Array.from({ length: Math.max(room, 1) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}本
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={room <= 0}
          onClick={() => {
            addToCart(id, Math.min(qty, room));
            setAdded(true);
          }}
          className="flex-1 bg-ink px-6 py-4 text-sm tracking-[0.25em] text-washi transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {room <= 0 ? "上限までカートに入っています" : "カートに入れる"}
        </button>
      </div>
      {added && inCart > 0 && (
        <p className="mt-3 text-sm text-ink/70" role="status">
          カートに{inCart}本入っています。
          <Link href="/shop/cart" className="ml-2 underline underline-offset-4">
            カートを見る
          </Link>
        </p>
      )}
    </div>
  );
}
