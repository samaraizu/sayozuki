import type { Metadata } from "next";
import Link from "next/link";
import { ClearCart } from "@/components/shop/ClearCart";
import { shop } from "@/lib/shop";

export const metadata: Metadata = { title: "ご注文ありがとうございます", robots: { index: false } };

export default async function CompletePage({ searchParams }: PageProps<"/shop/complete">) {
  const no = (await searchParams).no;
  const orderNo = typeof no === "string" && /^SY-\d{6}-\d{3}$/.test(no) ? no : null;

  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <ClearCart />
      <p className="text-[11px] tracking-[0.4em] text-moon">THANK YOU</p>
      <h1 className="mt-4 font-serif text-2xl tracking-[0.12em]">ご注文ありがとうございます</h1>
      {orderNo && (
        <p className="mt-8 text-sm">
          ご注文番号　<span className="font-medium tabular-nums">{orderNo}</span>
        </p>
      )}
      <p className="mt-6 text-sm leading-7 text-ink/70">
        ご注文内容を確認のうえ、送料を含めた合計金額とお支払い方法をメールでご案内いたします。
      </p>
      <p className="mt-2 text-xs leading-6 text-ink/50">{shop.paymentNote}</p>
      <Link href="/shop" className="mt-12 inline-block border border-ink px-8 py-4 text-sm tracking-[0.2em]">
        お取り寄せトップへ
      </Link>
    </div>
  );
}
