import type { Quote } from "@/lib/order";
import { yen } from "@/lib/site";

/** 金額の内訳。カート・確認・完了の各画面で共通 */
export function OrderSummary({ q, showShipping = true }: { q: Quote; showShipping?: boolean }) {
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between">
        <dt>商品小計</dt>
        <dd className="tabular-nums">{yen(q.subtotal)}</dd>
      </div>
      {showShipping && (
        <div className="flex justify-between">
          <dt>
            送料
            {q.shipping && <span className="ml-2 text-xs text-sub">（{q.shipping.region}）</span>}
          </dt>
          <dd className="tabular-nums">{q.shipping ? yen(q.shipping.fee) : "お届け先の入力後に計算"}</dd>
        </div>
      )}
      {q.paymentFee > 0 && (
        <div className="flex justify-between">
          <dt>代引手数料</dt>
          <dd className="tabular-nums">{yen(q.paymentFee)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <dt className="font-bold">合計（税込）</dt>
        <dd className="text-2xl font-bold tabular-nums">{yen(q.total)}</dd>
      </div>
      <p className="text-right text-xs text-sub">うち消費税（10%）{yen(q.tax)}</p>
    </dl>
  );
}
