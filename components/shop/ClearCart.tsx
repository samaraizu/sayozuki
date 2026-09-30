"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart";
import { clearCheckout } from "@/lib/checkout";

/** 注文完了ページを開いたらカートと入力内容を空にする */
export function ClearCart() {
  useEffect(() => {
    clearCart();
    clearCheckout();
  }, []);
  return null;
}
