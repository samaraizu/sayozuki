"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { submitOrder, type OrderState } from "@/app/(ja)/shop/actions";
import { Bottle } from "@/components/shop/Bottle";
import { AgeNotice } from "@/components/shop/Notice";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { useCart } from "@/lib/cart";
import { updateCheckout, useCheckout } from "@/lib/checkout";
import { quote, validateInfo, validatePayment } from "@/lib/order";
import { delivery, findProduct, payments, shop } from "@/lib/shop";
import { yen } from "@/lib/site";
import { shopPath } from "@/lib/urls";

function Block({ title, edit, children }: { title: string; edit: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-brush text-lg">{title}</h2>
        <Link href={edit} className="text-xs text-sub underline underline-offset-4">
          変更する
        </Link>
      </div>
      {children}
    </section>
  );
}

export function CheckoutConfirm() {
  const router = useRouter();
  const { cart, count } = useCart();
  const c = useCheckout();
  const [state, formAction, pending] = useActionState<OrderState, FormData>(submitOrder, null);
  const err = state?.errors ?? {};
  const ready = count > 0 && !Object.keys(validateInfo(c)).length && !Object.keys(validatePayment(c)).length;

  useEffect(() => {
    if (count && !ready) router.replace(Object.keys(validateInfo(c)).length ? shopPath("/checkout") : shopPath("/checkout/payment"));
  }, [count, ready, c, router]);

  if (!ready) return null;
  const q = quote(cart, c.pref, c.payment);
  const pay = payments.find((p) => p.id === c.payment)!;
  const gift = delivery.gifts.find((g) => g.id === c.gift);
  const serverErrors = Object.entries(err).filter(([k]) => k !== "agree");

  return (
    <form action={formAction} className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="checkout" value={JSON.stringify(c)} />
      <input type="hidden" name="cart" value={JSON.stringify(cart)} />

      <div>
        <AgeNotice className="mb-8" />

        <Block title="ご注文商品" edit={shopPath("/cart")}>
          <ul className="divide-y divide-line">
            {q.lines.map((l) => {
              const p = findProduct(l.id)!;
              return (
                <li key={l.id} className="flex items-center gap-4 py-3 text-sm">
                  <Bottle product={p} className="size-16 shrink-0 bg-surface" />
                  <div className="flex-1">
                    <p className="font-brush text-base">{l.name}</p>
                    <p className="text-xs text-sub">
                      {l.volume}　{yen(l.price)} × {l.qty}本{p.custom && `　別注商品：${p.custom.leadTime}`}
                    </p>
                  </div>
                  <p className="tabular-nums">{yen(l.price * l.qty)}</p>
                </li>
              );
            })}
          </ul>
        </Block>

        <Block title="お届け先・ご注文者" edit={shopPath("/checkout")}>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-sub">お名前</dt>
            <dd>
              {c.name}（{c.kana}）様
            </dd>
            <dt className="text-sub">ご住所</dt>
            <dd>
              〒{c.zip}　{c.pref}
              {c.address}
            </dd>
            <dt className="text-sub">電話番号</dt>
            <dd>{c.tel}</dd>
            <dt className="text-sub">メール</dt>
            <dd className="break-all">{c.email}</dd>
            <dt className="text-sub">生年月日</dt>
            <dd>{c.birthdate}（20歳以上であることを確認済み）</dd>
          </dl>
        </Block>

        <Block title="お届け方法" edit={shopPath("/checkout")}>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-sub">受け取り方法</dt>
            <dd>{delivery.method}</dd>
            <dt className="text-sub">お届け希望</dt>
            <dd>
              {c.deliveryDate || "日付指定なし"}　{c.deliveryTime}
            </dd>
            <dt className="text-sub">のし・包装</dt>
            <dd>{gift?.label}</dd>
            <dt className="text-sub">ご要望</dt>
            <dd className="whitespace-pre-wrap">{c.note || "なし"}</dd>
          </dl>
        </Block>

        <Block title="お支払い方法" edit={shopPath("/checkout/payment")}>
          <p className="text-sm font-bold">{pay.label}</p>
          <p className="mt-1 text-xs leading-6 text-sub">
            {pay.note}　お支払い時期：{pay.timing}
          </p>
        </Block>
      </div>

      <aside className="h-fit bg-surface p-6 lg:sticky lg:top-6">
        <OrderSummary q={q} />
        <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-6">
          <input
            name="agree"
            type="checkbox"
            checked={c.agree}
            onChange={(e) => updateCheckout({ agree: e.target.checked })}
            className="mt-1 size-4 accent-green"
          />
          <span>
            ご注文内容と
            <Link href={shopPath("/legal")} target="_blank" className="underline underline-offset-4">
              特定商取引法に基づく表記
            </Link>
            （返品・キャンセル条件を含む）を確認し、同意します。
          </span>
        </label>
        {err.agree && <p className="mt-1 text-xs text-red-700">{err.agree}</p>}
        {serverErrors.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-red-700" role="alert">
            {serverErrors.map(([k, m]) => (
              <li key={k}>{m}</li>
            ))}
          </ul>
        )}
        <button
          type="submit"
          disabled={pending || !shop.open}
          className="mt-6 w-full bg-green py-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          {!shop.open ? "販売準備中です" : pending ? "送信しています…" : "注文を確定する"}
        </button>
        <Link href={shopPath("/checkout/payment")} className="mt-4 block text-center text-xs text-sub underline underline-offset-4">
          ← お支払い方法の選択に戻る
        </Link>
      </aside>
    </form>
  );
}
