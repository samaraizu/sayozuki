"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart";

/** 注文完了ページを開いたらカートを空にする */
export function ClearCart() {
  useEffect(() => clearCart(), []);
  return null;
}
