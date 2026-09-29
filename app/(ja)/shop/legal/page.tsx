import type { Metadata } from "next";
import { legal, shop } from "@/lib/shop";

export const metadata: Metadata = { title: "特定商取引法に基づく表記・酒類販売管理者標識" };

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-8 divide-y divide-line border-y border-line text-sm leading-7">
      {rows.map(([t, d]) => (
        <div key={t} className="grid gap-1 py-4 md:grid-cols-[12rem_1fr]">
          <dt className="text-sub">{t}</dt>
          <dd>{d}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function LegalPage() {
  const m = legal.salesManager;
  return (
    <div className="mx-auto max-w-3xl px-5 py-14 md:py-20">
      <h1 className="font-bold text-2xl">特定商取引法に基づく表記</h1>
      <Table
        rows={[
          ["販売業者", legal.seller],
          ["運営責任者", legal.representative],
          ["所在地", legal.address],
          ["電話番号", legal.tel],
          ["メールアドレス", legal.email],
          ["販売価格", "各商品ページに税込価格で表示しています。"],
          ["商品代金以外の費用", `送料。${shop.shippingNote}`],
          ["お支払い方法", shop.paymentNote],
          ["お届け時期", legal.shippingTime],
          ["返品・交換", legal.returns],
          ["酒類の販売について", "20歳未満の方には酒類を販売いたしません。ご注文時に生年月日を確認しています。"],
          ["酒類販売業免許", legal.license],
        ]}
      />

      <h2 id="manager" className="mt-20 font-bold text-2xl">
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
      <p className="mt-8 text-xs leading-6 text-sub">
        20歳未満の者の飲酒は法律で禁止されています。
      </p>
    </div>
  );
}
