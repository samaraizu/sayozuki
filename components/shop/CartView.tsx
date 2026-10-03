"use client";

import Link from "next/link";
import { Bottle } from "@/components/shop/Bottle";
import { AgeNotice } from "@/components/shop/Notice";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { setQty, useCart } from "@/lib/cart";
import { useCheckout } from "@/lib/checkout";
import { quote } from "@/lib/order";
import { findProduct, qtyRange, shop } from "@/lib/shop";
import { yen } from "@/lib/site";
import { shopPath } from "@/lib/urls";

export function CartView() {
  const { cart, count } = useCart();
  const c = useCheckout();
  const q = quote(cart, c.pref, "");

  if (!count) {
    return (
      <div className="py-16 text-center">
        <p>カートに商品が入っていません。</p>
        <Link href={shopPath("/#lineup")} className="mt-8 inline-block bg-ink px-10 py-4 text-sm text-white">
          日本酒を見る
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="cart-title">
        <h2 id="cart-title" className="sr-only">
          カートの商品
        </h2>
        <table className="w-full border-t-2 border-ink text-sm">
          <thead className="hidden bg-surface text-[13px] md:table-header-group">
            <tr>
              <th className="px-3 py-3 text-left font-bold">商品</th>
              <th className="px-3 py-3 text-right font-bold">単価（税込）</th>
              <th className="px-3 py-3 text-center font-bold">数量</th>
              <th className="px-3 py-3 text-right font-bold">小計</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => {
              const p = findProduct(l.id)!;
              const { min, max } = qtyRange(p);
              return (
                <tr key={l.id} className="grid grid-cols-[5rem_1fr] gap-x-4 border-b border-line py-4 md:table-row md:py-0">
                  <td className="row-span-3 md:px-3 md:py-4">
                    <div className="flex items-center gap-4">
                      <Bottle product={p} className="size-20 shrink-0 bg-surface" />
                      <div className="hidden md:block">
                        <Link href={shopPath(`/${p.id}`)} className="font-brush text-base hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-sub">{p.volume}</p>
                        {p.custom && <p className="mt-1 text-xs text-green">別注商品：{p.custom.leadTime}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="md:hidden">
                    <Link href={shopPath(`/${p.id}`)} className="font-brush text-base">
                      {p.name}
                    </Link>
                    <p className="text-xs text-sub">
                      {p.volume}　{yen(p.price)}
                    </p>
                  </td>
                  <td className="hidden px-3 py-4 text-right tabular-nums md:table-cell">{yen(p.price)}</td>
                  <td className="md:px-3 md:py-4 md:text-center">
                    <label className="sr-only" htmlFor={`qty_${p.id}`}>
                      {p.name}の本数
                    </label>
                    <select
                      id={`qty_${p.id}`}
                      value={l.qty}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                      className="border border-line bg-white px-2 py-1.5"
                    >
                      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                        <option key={n} value={n}>
                          {n}本
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setQty(p.id, 0)} className="ml-3 text-xs text-sub underline underline-offset-4">
                      削除
                    </button>
                  </td>
                  <td className="text-right tabular-nums md:px-3 md:py-4">{yen(l.price * l.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Link href={shopPath("/#lineup")} className="mt-6 inline-block text-sm text-sub underline underline-offset-4">
          ← 買い物を続ける
        </Link>
      </section>

      <aside className="h-fit bg-surface p-6">
        <OrderSummary q={q} />
        <p className="mt-4 text-xs leading-6 text-sub">{shop.shippingNote}</p>
        <AgeNotice className="mt-6" />
        <Link href={shopPath("/checkout")} className="mt-6 block bg-green py-4 text-center text-sm font-bold text-white hover:opacity-90">
          ご購入手続きへ進む
        </Link>
      </aside>
    </div>
  );
}
