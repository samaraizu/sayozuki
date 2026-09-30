"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart, useCart } from "@/lib/cart";
import { findProduct, qtyRange } from "@/lib/shop";

export function AddToCart({ id }: { id: string }) {
  const p = findProduct(id)!;
  const { min, max } = qtyRange(p);
  const { cart } = useCart();
  const inCart = cart[id] ?? 0;
  // 既にカートにある本数を差し引いた、追加できる範囲
  const addMin = inCart ? 1 : min;
  const addMax = max - inCart;
  const [qty, setQty] = useState(min);
  const [added, setAdded] = useState(false);
  const value = Math.min(Math.max(qty, addMin), Math.max(addMax, addMin));

  return (
    <div>
      <div className="flex gap-3">
        <label className="sr-only" htmlFor="qty">
          本数
        </label>
        <select
          id="qty"
          value={value}
          onChange={(e) => setQty(Number(e.target.value))}
          disabled={addMax <= 0}
          className="border border-line bg-white px-4 py-4 text-sm"
        >
          {Array.from({ length: Math.max(addMax - addMin + 1, 1) }, (_, i) => addMin + i).map((n) => (
            <option key={n} value={n}>
              {n}本
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={addMax <= 0}
          onClick={() => {
            addToCart(id, value);
            setAdded(true);
          }}
          className="flex-1 bg-ink px-6 py-4 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {addMax <= 0 ? "上限までカートに入っています" : "カートに入れる"}
        </button>
      </div>
      {added && inCart > 0 && (
        <p className="mt-3 text-sm" role="status">
          カートに{inCart}本入っています。
          <Link href="/shop/cart" className="ml-2 underline underline-offset-4">
            カートを見る
          </Link>
        </p>
      )}
    </div>
  );
}
