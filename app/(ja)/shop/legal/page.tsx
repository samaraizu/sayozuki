import type { Metadata } from "next";
import { boxCapacity, delivery, legal, payments, regions, shippingRates } from "@/lib/shop";
import { yen } from "@/lib/site";

export const metadata: Metadata = { title: "特定商取引法に基づく表記・酒類販売管理者標識" };

function Table({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="mt-8 divide-y divide-line border-y border-line text-sm leading-7">
      {rows.map(([t, d]) => (
        <div key={t} className="grid gap-1 py-4 md:grid-cols-[12rem_1fr]">
          <dt className="font-bold">{t}</dt>
          <dd>{d}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function LegalPage() {
  const m = legal.salesManager;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-5 md:py-16">
      <h1 className="font-brush text-3xl font-bold">特定商取引法に基づく表記</h1>
      <Table
        rows={[
          ["販売事業者", legal.seller],
          ["運営責任者", legal.representative],
          ["所在地", legal.address],
          ["電話番号", legal.tel],
          ["メールアドレス", legal.email],
          ["販売価格", "各商品ページに消費税込みの価格で表示しています。"],
          [
            "商品代金以外の必要料金",
            <>
              送料（下記の送料表のとおり）。代金引換の場合は代引手数料 {yen(payments.find((p) => p.id === "cod")!.fee)}
              。銀行振込の場合の振込手数料はお客様のご負担となります。
            </>,
          ],
          [
            "支払方法・支払時期",
            <ul key="pay" className="space-y-1">
              {payments.map((p) => (
                <li key={p.id}>
                  <span className="font-bold">{p.label}</span>：{p.timing}
                </li>
              ))}
            </ul>,
          ],
          ["引渡時期", legal.shippingTime],
          ["受け取り方法", `${delivery.method}。${delivery.methodNote}`],
          ["返品・交換", legal.returns],
          ["キャンセル", legal.cancel],
          ["酒類の販売について", "20歳未満の方には酒類を販売いたしません。ご注文時に生年月日と20歳以上であることを確認しています。"],
          ["酒類販売業免許", legal.license],
        ]}
      />

      <h2 id="shipping" className="mt-16 font-brush text-2xl font-bold">
        送料表（税込）
      </h2>
      <p className="mt-3 text-xs leading-6 text-sub">
        1箱あたりの料金です。四合瓶（720ml）換算で{boxCapacity.small}本までは小箱、{boxCapacity.large}本までは大箱でお届けします（一升瓶は2本として数えます）。{boxCapacity.large}本を超える場合は複数の箱に分けてお送りします。
      </p>
      <table className="mt-6 w-full border-t-2 border-ink text-sm">
        <thead className="bg-surface text-[13px]">
          <tr>
            <th className="px-3 py-2.5 text-left font-bold">地域</th>
            <th className="px-3 py-2.5 text-right font-bold">小箱（〜{boxCapacity.small}本）</th>
            <th className="px-3 py-2.5 text-right font-bold">大箱（〜{boxCapacity.large}本）</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <th scope="row" className="px-3 py-2.5 text-left font-normal">
                {r.name}
                <span className="block text-[11px] text-sub">{r.prefs.join("・")}</span>
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums">{yen(shippingRates[r.id].small)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{yen(shippingRates[r.id].large)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="manager" className="mt-16 font-brush text-2xl font-bold">
        酒類販売管理者標識
      </h2>
      <Table
        rows={[
          ["販売場の名称及び所在地", `${m.storeName}　${m.storeAddress}`],
          ["酒類販売管理者の氏名", m.manager],
          ["酒類販売管理研修受講年月日", m.trainedOn],
          ["次回研修の受講期限", m.nextTrainingBy],
          ["研修実施団体名", m.trainer],
        ]}
      />
      <p className="mt-8 text-xs leading-6 text-sub">20歳未満の者の飲酒は法律で禁止されています。</p>
    </div>
  );
}
