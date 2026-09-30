"use client";

import { emptyCheckout, type Checkout } from "@/lib/order";
import { createStore } from "@/lib/store";

/** ご注文手続きの入力。タブを閉じると消えるよう sessionStorage に置く */
const store = createStore<Checkout>("sayozuki-checkout", "session", emptyCheckout, (raw) => ({
  ...emptyCheckout,
  ...(raw as Partial<Checkout>),
}));

export const useCheckout = store.useValue;
export const updateCheckout = (patch: Partial<Checkout>) => store.set({ ...store.get(), ...patch });
export const clearCheckout = () => store.set(emptyCheckout);
