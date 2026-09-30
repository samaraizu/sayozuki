"use client";

import { useSyncExternalStore } from "react";

/**
 * ブラウザに保存する小さな状態。カートと注文手続きの入力で使う。
 * 保存できない環境（プライベートブラウズなど）でも、開いているあいだは使える。
 */
export function createStore<T>(key: string, storage: "local" | "session", initial: T, clean: (raw: unknown) => T) {
  const listeners = new Set<() => void>();
  let cache: T | null = null;
  const area = () => (storage === "local" ? localStorage : sessionStorage);

  function get(): T {
    if (cache !== null) return cache;
    try {
      const raw = area().getItem(key);
      cache = raw ? clean(JSON.parse(raw)) : initial;
    } catch {
      cache = initial;
    }
    return cache;
  }

  function set(next: T) {
    cache = next;
    try {
      area().setItem(key, JSON.stringify(next));
    } catch {}
    listeners.forEach((l) => l());
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
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

  const useValue = () => useSyncExternalStore(subscribe, get, () => initial);
  return { get, set, useValue };
}
