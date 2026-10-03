"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { useCart } from "@/lib/cart";
import { updateCheckout, useCheckout } from "@/lib/checkout";
import { quote, validateInfo, validatePayment } from "@/lib/order";
import { payments } from "@/lib/shop";
import { yen } from "@/lib/site";
import { shopPath } from "@/lib/urls";

export function CheckoutPayment() {
  const router = useRouter();
  const { cart, count } = useCart();
  const c = useCheckout();
  const [error, setError] = useState("");
  const infoOk = Object.keys(validateInfo(c)).length === 0;

  // お届け先が未入力のまま直接開かれたら手順1へ戻す
  useEffect(() => {
    if (count && !infoOk) router.replace(shopPath("/checkout"));
  }, [count, infoOk, router]);

  if (!count || !infoOk) return null;
  const q = quote(cart, c.pref, c.payment);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const found = validatePayment(c);
          if (found.payment) return setError(found.payment);
          router.push(shopPath("/checkout/confirm"));
        }}
      >
        <fieldset>
          <legend className="mb-6 w-full border-l-4 border-green pl-3 font-brush text-xl">お支払い方法</legend>
          <div className="space-y-3" role="radiogroup">
            {payments.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-4 border p-5 transition-colors ${c.payment === p.id ? "border-green bg-green-soft" : "border-line bg-white hover:border-sub"}`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={c.payment === p.id}
                  onChange={() => {
                    updateCheckout({ payment: p.id });
                    setError("");
                  }}
                  className="mt-1 size-4 accent-green"
                />
                <span className="flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold">{p.label}</span>
                    <span className="text-xs text-sub">{p.fee ? `手数料 ${yen(p.fee)}` : "手数料無料"}</span>
                  </span>
                  <span className="mt-2 block text-xs leading-6 text-sub">{p.note}</span>
                  <span className="mt-1 block text-xs leading-6 text-sub">お支払い時期：{p.timing}</span>
                </span>
              </label>
            ))}
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </fieldset>
        <div className="mt-10 flex flex-col-reverse items-center justify-between gap-4 border-t border-line pt-8 sm:flex-row">
          <Link href={shopPath("/checkout")} className="text-sm text-sub underline underline-offset-4">
            ← お届け先の入力に戻る
          </Link>
          <button type="submit" className="w-full bg-green px-12 py-4 text-sm font-bold text-white hover:opacity-90 sm:w-auto">
            ご注文内容の確認へ進む
          </button>
        </div>
      </form>
      <aside className="h-fit bg-surface p-6">
        <p className="mb-4 text-sm font-bold">お支払い金額</p>
        <OrderSummary q={q} />
      </aside>
    </div>
  );
}
