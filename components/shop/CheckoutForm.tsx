"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitOrder, type OrderState } from "@/app/(ja)/shop/actions";
import { Bottle } from "@/components/shop/Bottle";
import { setQty, useCart } from "@/lib/cart";
import { findProduct, shop } from "@/lib/shop";
import { yen } from "@/lib/site";

const field =
  "mt-1.5 w-full border border-line bg-white px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-green";
const label = "block text-[13px] font-bold";

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-700">{msg}</p> : null;
}

export function CheckoutForm() {
  const { cart, count, total } = useCart();
  const [state, formAction, pending] = useActionState<OrderState, FormData>(submitOrder, null);
  const err = state?.errors ?? {};
  const v = state?.values ?? {};

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: findProduct(id)!, qty }))
    .filter((l) => l.product);

  if (!count) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink">カートに商品が入っていません。</p>
        <Link href="/shop#sake" className="mt-8 inline-block border border-ink px-8 py-4 text-sm">
          日本酒を見る
        </Link>
      </div>
    );
  }

  return (
    <form
      key={state?.key ?? "init"}
      action={formAction}
      className="grid gap-16 lg:grid-cols-[1fr_1.1fr]"
      noValidate
    >
      {/* カートの中身 */}
      <section aria-labelledby="cart-title">
        <h2 id="cart-title" className="font-bold text-lg">
          ご注文内容
        </h2>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {lines.map(({ product: p, qty }) => (
            <li key={p.id} className="flex gap-4 py-5">
              <Bottle product={p} className="size-20 shrink-0 bg-surface" />
              <div className="flex-1">
                <Link href={`/shop/${p.id}`} className="font-bold hover:underline">
                  {p.name}
                </Link>
                <p className="mt-1 text-xs text-sub">
                  {p.volume}　{yen(p.price)}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <label className="sr-only" htmlFor={`qty_${p.id}`}>
                    {p.name}の本数
                  </label>
                  {/* 送る本数はカートの値。画面の select はリセットで戻ることがあるため使わない */}
                  <input type="hidden" name={`qty_${p.id}`} value={qty} />
                  <select
                    id={`qty_${p.id}`}
                    value={qty}
                    onChange={(e) => setQty(p.id, Number(e.target.value))}
                    className="border border-line bg-transparent px-2 py-1 text-sm"
                  >
                    {Array.from({ length: shop.maxQty }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}本
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setQty(p.id, 0)}
                    className="text-xs text-sub underline underline-offset-4"
                  >
                    削除
                  </button>
                </div>
              </div>
              <p className="text-sm tabular-nums">{yen(p.price * qty)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex items-baseline justify-between">
          <span className="text-sm">小計（税込）</span>
          <span className="text-2xl tabular-nums">{yen(total)}</span>
        </div>
        <p className="mt-3 text-xs leading-6 text-sub">{shop.shippingNote}</p>
      </section>

      {/* お届け先 */}
      <section aria-labelledby="ship-title" className="grid content-start gap-7">
        <h2 id="ship-title" className="font-bold text-lg">
          お届け先
        </h2>

        <div>
          <label htmlFor="name" className={label}>
            お名前<span className="ml-1 text-moon">*</span>
          </label>
          <input id="name" name="name" defaultValue={v.name} autoComplete="name" className={field} />
          <Err msg={err.name} />
        </div>

        <div className="grid gap-7 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className={label}>
              メールアドレス<span className="ml-1 text-moon">*</span>
            </label>
            <input id="email" name="email" defaultValue={v.email} type="email" autoComplete="email" className={field} />
            <Err msg={err.email} />
          </div>
          <div>
            <label htmlFor="tel" className={label}>
              電話番号<span className="ml-1 text-moon">*</span>
            </label>
            <input id="tel" name="tel" defaultValue={v.tel} type="tel" autoComplete="tel" className={field} />
            <Err msg={err.tel} />
          </div>
        </div>

        <div className="grid gap-7 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="zip" className={label}>
              郵便番号<span className="ml-1 text-moon">*</span>
            </label>
            <input
              id="zip"
              name="zip" defaultValue={v.zip}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="999-3242"
              className={field}
            />
            <Err msg={err.zip} />
          </div>
          <div>
            <label htmlFor="address" className={label}>
              ご住所<span className="ml-1 text-moon">*</span>
            </label>
            <input id="address" name="address" defaultValue={v.address} autoComplete="street-address" className={field} />
            <Err msg={err.address} />
          </div>
        </div>

        <div>
          <label htmlFor="birthdate" className={label}>
            生年月日<span className="ml-1 text-moon">*</span>
          </label>
          <input id="birthdate" name="birthdate" defaultValue={v.birthdate} type="date" autoComplete="bday" className={field} />
          <Err msg={err.birthdate} />
        </div>

        <div>
          <label htmlFor="note" className={label}>
            ご要望（お届け希望日・のし など）
          </label>
          <textarea id="note" name="note" defaultValue={v.note} rows={3} className={`${field} resize-y`} />
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input type="checkbox" name="adult" defaultChecked={v.adult === "on"} className="mt-1 accent-moon" />
            <span>
              私は20歳以上です。
              <span className="block text-xs text-sub">
                お届けの際に年齢確認をお願いする場合があります。
              </span>
            </span>
          </label>
          <Err msg={err.adult} />
        </div>

        <div>
          {err.form && (
            <p className="mb-4 text-sm text-red-700" role="alert">
              {err.form}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || !shop.open}
            className="w-full bg-ink px-8 py-4 text-sm text-washi transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {!shop.open ? "販売準備中です" : pending ? "送信しています…" : "注文を確定する"}
          </button>
          <p className="mt-4 text-xs leading-6 text-sub">{shop.paymentNote}</p>
          <p className="mt-2 text-xs leading-6 text-sub">
            ご注文前に
            <Link href="/shop/legal" className="underline underline-offset-4">
              特定商取引法に基づく表記
            </Link>
            をご確認ください。
          </p>
        </div>
      </section>
    </form>
  );
}
