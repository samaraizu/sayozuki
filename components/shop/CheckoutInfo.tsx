"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, inputCls } from "@/components/shop/fields";
import { AgeNotice } from "@/components/shop/Notice";
import { useCart } from "@/lib/cart";
import { updateCheckout, useCheckout } from "@/lib/checkout";
import { deliveryDateRange, validateInfo, type CheckoutErrors } from "@/lib/order";
import { delivery, prefectures } from "@/lib/shop";

export function CheckoutInfo() {
  const router = useRouter();
  const { count } = useCart();
  const c = useCheckout();
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const range = deliveryDateRange();
  // 直した項目のエラーはその場で消す
  const clearError = (k: keyof CheckoutErrors) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  if (!count) {
    return (
      <p className="py-16 text-center">
        カートに商品がありません。
        <Link href="/shop#lineup" className="ml-2 underline underline-offset-4">
          日本酒を見る
        </Link>
      </p>
    );
  }

  const bind = (k: "name" | "kana" | "email" | "tel" | "zip" | "address" | "birthdate" | "deliveryDate" | "note") => ({
    id: k,
    value: c[k],
    onChange: (e: { target: { value: string } }) => {
      updateCheckout({ [k]: e.target.value });
      clearError(k);
    },
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
    className: inputCls,
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const found = validateInfo(c);
        setErrors(found);
        if (Object.keys(found).length) {
          document.getElementById(Object.keys(found)[0])?.focus();
          return;
        }
        router.push("/shop/checkout/payment");
      }}
      className="mx-auto max-w-3xl space-y-12"
    >
      <fieldset className="grid gap-6 sm:grid-cols-2">
        <legend className="mb-6 w-full border-l-4 border-green pl-3 font-brush text-xl">お届け先・ご注文者</legend>
        <Field id="name" label="お名前" required error={errors.name}>
          <input {...bind("name")} autoComplete="name" placeholder="山形 花子" />
        </Field>
        <Field id="kana" label="フリガナ" required error={errors.kana}>
          <input {...bind("kana")} placeholder="ヤマガタ ハナコ" />
        </Field>
        <Field id="email" label="メールアドレス" required error={errors.email} hint="ご注文確認のメールをお送りします">
          <input {...bind("email")} type="email" autoComplete="email" />
        </Field>
        <Field id="tel" label="電話番号" required error={errors.tel} hint="配送時の連絡に使います">
          <input {...bind("tel")} type="tel" autoComplete="tel" />
        </Field>
        <Field id="zip" label="郵便番号" required error={errors.zip}>
          <input {...bind("zip")} inputMode="numeric" autoComplete="postal-code" placeholder="999-3242" />
        </Field>
        <Field id="pref" label="都道府県" required error={errors.pref}>
          <select
            id="pref"
            value={c.pref}
            onChange={(e) => {
              updateCheckout({ pref: e.target.value });
              clearError("pref");
            }}
            aria-invalid={!!errors.pref}
            autoComplete="address-level1"
            className={inputCls}
          >
            <option value="">選んでください</option>
            {prefectures.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field id="address" label="市区町村・番地・建物名" required error={errors.address} className="sm:col-span-2">
          <input {...bind("address")} autoComplete="street-address" placeholder="上山市葉山5-63" />
        </Field>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="mb-6 w-full border-l-4 border-green pl-3 font-brush text-xl">年齢の確認</legend>
        <AgeNotice />
        <Field id="birthdate" label="生年月日" required error={errors.birthdate} className="sm:w-1/2">
          <input {...bind("birthdate")} type="date" autoComplete="bday" />
        </Field>
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              id="adult"
              type="checkbox"
              checked={c.adult}
              onChange={(e) => {
                updateCheckout({ adult: e.target.checked });
                clearError("adult");
              }}
              aria-invalid={!!errors.adult}
              className="mt-1 size-4 accent-green"
            />
            <span>
              <span className="font-bold">私は20歳以上です。</span>
              <span className="mt-1 block text-xs text-sub">お届けの際に年齢確認をお願いする場合があります。</span>
            </span>
          </label>
          {errors.adult && <p className="mt-1 text-xs text-red-700">{errors.adult}</p>}
        </div>
      </fieldset>

      <fieldset className="grid gap-6 sm:grid-cols-2">
        <legend className="mb-6 w-full border-l-4 border-green pl-3 font-brush text-xl">お届け方法</legend>
        <div className="border border-line bg-surface p-5 sm:col-span-2">
          <p className="text-sm font-bold">受け取り方法：{delivery.method}</p>
          <p className="mt-2 text-xs leading-6 text-sub">{delivery.methodNote}</p>
        </div>
        <Field id="deliveryDate" label="お届け希望日" error={errors.deliveryDate} hint={`${range.min}以降で選べます（指定なしも可）`}>
          <input {...bind("deliveryDate")} type="date" min={range.min} max={range.max} />
        </Field>
        <Field id="deliveryTime" label="お届け希望時間帯" error={errors.deliveryTime}>
          <select id="deliveryTime" value={c.deliveryTime} onChange={(e) => updateCheckout({ deliveryTime: e.target.value })} className={inputCls}>
            {delivery.times.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <p className="text-[13px] font-bold">のし・ギフト包装</p>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {delivery.gifts.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="gift" checked={c.gift === g.id} onChange={() => updateCheckout({ gift: g.id })} className="accent-green" />
                {g.label}
              </label>
            ))}
          </div>
        </div>
        <Field id="note" label="ご要望" className="sm:col-span-2" hint="のしの表書き・お名入れなど">
          <textarea {...bind("note")} rows={3} />
        </Field>
      </fieldset>

      <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-line pt-8 sm:flex-row">
        <Link href="/shop/cart" className="text-sm text-sub underline underline-offset-4">
          ← カートに戻る
        </Link>
        <button type="submit" className="w-full bg-green px-12 py-4 text-sm font-bold text-white hover:opacity-90 sm:w-auto">
          お支払い方法の選択へ進む
        </button>
      </div>
    </form>
  );
}
