"use client";

import { findProduct, qtyRange } from "@/lib/shop";
import { createStore } from "@/lib/store";

/** 商品ID → 本数 */
export type Cart = Record<string, number>;

const clamp = (id: string, n: number) => {
  const p = findProduct(id);
  if (!p) return 0;
  const { min, max } = qtyRange(p);
  const q = Math.floor(n);
  return q <= 0 ? 0 : Math.min(Math.max(q, min), max);
};

const store = createStore<Cart>("sayozuki-cart", "local", {}, (raw) =>
  // 商品が消えた・本数の範囲が変わった場合に備えて読み込み時に整える
  Object.fromEntries(
    Object.entries((raw ?? {}) as Cart)
      .map(([id, n]) => [id, clamp(id, Number(n))] as const)
      .filter(([, n]) => n > 0),
  ),
);

export function useCart() {
  const cart = store.useValue();
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce((sum, [id, n]) => sum + (findProduct(id)?.price ?? 0) * n, 0);
  return { cart, count, total };
}

export function setQty(id: string, qty: number) {
  const next = { ...store.get() };
  const n = clamp(id, qty);
  if (n === 0) delete next[id];
  else next[id] = n;
  store.set(next);
}

export function addToCart(id: string, qty = 1) {
  setQty(id, (store.get()[id] ?? 0) + qty);
}

export function clearCart() {
  store.set({});
}
