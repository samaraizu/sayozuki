import type { Metadata } from "next";
import Link from "next/link";
import { ClearCart } from "@/components/shop/ClearCart";
import { StepBar } from "@/components/shop/StepBar";
import { delivery, payments } from "@/lib/shop";
import { shopPath } from "@/lib/urls";

export const metadata: Metadata = { title: "ご注文完了", robots: { index: false } };

const next: Record<string, string> = {
  card: "このあと決済代行会社の画面でお支払いを完了してください。お支払いの確認後、3営業日以内に発送いたします。",
  bank: "振込先をメールでお送りしました。ご注文から7日以内にお振り込みください。ご入金を確認してから発送いたします。",
  cod: "3営業日以内に発送いたします。商品のお受け取り時に、配達員へ代金をお支払いください。",
};

export default async function CompletePage({ searchParams }: PageProps<"/shop/complete">) {
  const sp = await searchParams;
  const orderNo = typeof sp.no === "string" && /^SY-\d{6}-\d{3}$/.test(sp.no) ? sp.no : null;
  const pay = payments.find((p) => p.id === sp.pay);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-5 md:py-16">
      <ClearCart />
      <StepBar current={4} />
      <div className="border border-line px-6 py-12 text-center md:px-12">
        <p className="font-en text-2xl font-medium">THANK YOU</p>
        <h1 className="mt-3 font-brush text-3xl font-bold">ご注文ありがとうございます</h1>
        {orderNo && (
          <p className="mt-8 inline-block bg-surface px-6 py-3 text-sm">
            ご注文番号　<span className="font-bold tabular-nums">{orderNo}</span>
          </p>
        )}
        <p className="mt-6 text-sm leading-7">ご登録のメールアドレスに、ご注文内容の確認メールをお送りしました。</p>
        {pay && (
          <div className="mx-auto mt-8 max-w-xl bg-green-soft p-5 text-left text-sm leading-7">
            <p className="font-bold text-green">お支払い方法：{pay.label}</p>
            <p className="mt-1">{next[pay.id]}</p>
          </div>
        )}
        <p className="mt-6 text-xs leading-6 text-sub">
          {delivery.methodNote}
          <br />
          20歳未満の者の飲酒は法律で禁止されています。
        </p>
        <Link href={shopPath("/")} className="mt-10 inline-block bg-ink px-10 py-4 text-sm text-white">
          お取り寄せトップへ
        </Link>
      </div>
    </div>
  );
}
