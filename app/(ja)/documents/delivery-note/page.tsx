import type { Metadata } from "next";
import { Issuer } from "@/components/docs/DocHeader";
import { PrintButton } from "@/components/docs/PrintButton";
import { delivery, payments } from "@/lib/shop";
import { sampleOrder as o, sampleQuote as q } from "@/lib/sample-order";
import { yen } from "@/lib/site";

export const metadata: Metadata = { title: "納品書（フォーマット案）" };

export default function DeliveryNote() {
  const c = o.checkout;
  return (
    <>
      <div className="mx-auto mb-4 flex w-[210mm] max-w-full justify-between print:hidden">
        <p className="text-sm text-sub">納品書のフォーマット案（サンプルデータ）</p>
        <PrintButton />
      </div>
      <article className="mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[16mm] py-[14mm] text-[12px] leading-6 text-ink shadow print:shadow-none">
        <header className="flex items-end justify-between border-b-2 border-ink pb-3">
          <h1 className="text-2xl font-bold tracking-[0.5em]">納品書</h1>
          <dl className="grid grid-cols-[5rem_auto] text-[11px]">
            <dt>注文番号</dt>
            <dd>{o.no}</dd>
            <dt>ご注文日</dt>
            <dd>{o.orderedOn}</dd>
            <dt>発送日</dt>
            <dd>{o.shippedOn}</dd>
          </dl>
        </header>

        <div className="mt-6 flex justify-between gap-8">
          <div>
            <p className="text-base font-bold">{c.name} 様</p>
            <p className="mt-1">
              〒{c.zip}　{c.pref}
              {c.address}
            </p>
            <p>TEL {c.tel}</p>
            <p className="mt-4">下記の通り納品いたします。</p>
          </div>
          <Issuer />
        </div>

        <table className="mt-8 w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-surface">
              <th className="border border-line px-2 py-1.5 text-left">品名（品目・容量）</th>
              <th className="w-16 border border-line px-2 py-1.5 text-right">数量</th>
              <th className="w-24 border border-line px-2 py-1.5 text-right">単価（税込）</th>
              <th className="w-24 border border-line px-2 py-1.5 text-right">金額（税込）</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.id}>
                <td className="border border-line px-2 py-1.5">
                  {l.name}（清酒・{l.volume}）<span className="ml-1 text-[10px]">※</span>
                </td>
                <td className="border border-line px-2 py-1.5 text-right">{l.qty}本</td>
                <td className="border border-line px-2 py-1.5 text-right">{yen(l.price)}</td>
                <td className="border border-line px-2 py-1.5 text-right">{yen(l.price * l.qty)}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-line px-2 py-1.5">送料（{q.shipping?.region}）</td>
              <td className="border border-line px-2 py-1.5 text-right">1式</td>
              <td className="border border-line px-2 py-1.5 text-right">{yen(q.shipping?.fee ?? 0)}</td>
              <td className="border border-line px-2 py-1.5 text-right">{yen(q.shipping?.fee ?? 0)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="grid w-72 grid-cols-[1fr_auto] gap-y-1">
            <dt>合計（税込）</dt>
            <dd className="text-right text-base font-bold">{yen(q.total)}</dd>
            <dt>10%対象</dt>
            <dd className="text-right">{yen(q.total)}</dd>
            <dt>うち消費税（10%）</dt>
            <dd className="text-right">{yen(q.tax)}</dd>
          </dl>
        </div>
        <p className="mt-2 text-[10px]">※ 酒類（消費税率10%）</p>

        <dl className="mt-8 grid grid-cols-[7rem_1fr] gap-y-1 border-t border-line pt-4 text-[11px]">
          <dt>お支払い方法</dt>
          <dd>{payments.find((p) => p.id === c.payment)?.label}</dd>
          <dt>受け取り方法</dt>
          <dd>{delivery.method}</dd>
        </dl>

        <p className="mt-10 border-2 border-ink px-4 py-3 text-center text-sm font-bold">
          20歳未満の者の飲酒は法律で禁止されています。
        </p>
        <p className="mt-3 text-[10px] leading-5 text-sub">
          商品の破損・誤配送・品質不良の場合は、到着後7日以内にご連絡ください。お客様のご都合による返品・交換はお受けできません。
        </p>
      </article>
    </>
  );
}
