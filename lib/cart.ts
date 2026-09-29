"use client";

import { useSyncExternalStore } from "react";
import { findProduct, shop } from "@/lib/shop";

/** 商品ID → 本数 */
export type Cart = Record<string, number>;

const KEY = "sayozuki-cart";
const EMPTY: Cart = {};
const listeners = new Set<() => void>();
let cache: Cart | null = null;

function read(): Cart {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Cart;
    // 商品が消えた・上限が変わった場合に備えて読み込み時に整える
    cache = Object.fromEntries(
      Object.entries(raw)
        .filter(([id, n]) => findProduct(id) && Number.isInteger(n) && n > 0)
        .map(([id, n]) => [id, Math.min(n, shop.maxQty)]),
    );
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Cart) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できない環境（プライベートブラウズなど）でも、開いているあいだは使える
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  const cart = useSyncExternalStore(subscribe, read, () => EMPTY);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce(
    (sum, [id, n]) => sum + (findProduct(id)?.price ?? 0) * n,
    0,
  );
  return { cart, count, total };
}

export function setQty(id: string, qty: number) {
  const next = { ...read() };
  const n = Math.max(0, Math.min(Math.floor(qty), shop.maxQty));
  if (n === 0) delete next[id];
  else next[id] = n;
  write(next);
}

export function addToCart(id: string, qty = 1) {
  setQty(id, (read()[id] ?? 0) + qty);
}

export function clearCart() {
  write({});
}
