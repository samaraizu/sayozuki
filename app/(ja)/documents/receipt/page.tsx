import type { Metadata } from "next";
import { Issuer } from "@/components/docs/DocHeader";
import { PrintButton } from "@/components/docs/PrintButton";
import { payments } from "@/lib/shop";
import { sampleOrder as o, sampleQuote as q } from "@/lib/sample-order";
import { yen } from "@/lib/site";

export const metadata: Metadata = { title: "領収書（フォーマット案）" };

export default function Receipt() {
  const c = o.checkout;
  return (
    <>
      <div className="mx-auto mb-4 flex w-[210mm] max-w-full justify-between print:hidden">
        <p className="text-sm text-sub">領収書のフォーマット案（サンプルデータ）</p>
        <PrintButton />
      </div>
      <article className="mx-auto min-h-[148mm] w-[210mm] max-w-full bg-white px-[16mm] py-[14mm] text-[12px] leading-6 text-ink shadow print:shadow-none">
        <header className="flex items-end justify-between border-b-2 border-ink pb-3">
          <h1 className="text-2xl font-bold tracking-[0.5em]">領収書</h1>
          <dl className="grid grid-cols-[5rem_auto] text-[11px]">
            <dt>No.</dt>
            <dd>{o.no}</dd>
            <dt>発行日</dt>
            <dd>{o.shippedOn}</dd>
          </dl>
        </header>

        <p className="mt-8 w-2/3 border-b border-ink pb-1 text-lg font-bold">{c.name} 様</p>

        <div className="mx-auto mt-8 w-4/5 bg-surface py-5 text-center">
          <p className="text-[11px]">金額</p>
          <p className="text-3xl font-bold tracking-wider">{yen(q.total)}-</p>
          <p className="mt-1 text-[11px]">（税込）</p>
        </div>

        <dl className="mx-auto mt-6 grid w-4/5 grid-cols-[7rem_1fr] gap-y-1">
          <dt>但し</dt>
          <dd>清酒代（送料を含む）として</dd>
          <dt>内訳</dt>
          <dd>
            10%対象 {yen(q.total)}（うち消費税 {yen(q.tax)}）
          </dd>
          <dt>お支払い方法</dt>
          <dd>{payments.find((p) => p.id === c.payment)?.label}</dd>
        </dl>
        <p className="mx-auto mt-2 w-4/5">上記正に領収いたしました。</p>

        <div className="mt-10 flex items-end justify-between">
          <p className="text-[10px] leading-5 text-sub">
            クレジットカード決済の場合、印紙税は課税されません。
            <br />
            20歳未満の者の飲酒は法律で禁止されています。
          </p>
          <Issuer />
        </div>
      </article>
    </>
  );
}
