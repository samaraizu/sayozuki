import Link from "next/link";
import { Bottle } from "@/components/shop/Bottle";
import type { Product } from "@/lib/shop";
import { yen } from "@/lib/site";

/** 一覧の商品カード。【】の見出し・銘柄・容量・右寄せの価格 */
export function ProductCard({ product: p, badge }: { product: Product; badge?: string }) {
  return (
    <Link href={`/shop/${p.id}`} className="group flex h-full flex-col bg-white">
      <Bottle product={p} className="aspect-square bg-surface transition-opacity group-hover:opacity-85" />
      <div className="flex flex-1 flex-col px-1 pt-3 text-[13px] leading-6 md:text-sm">
        <p>【{badge ?? (p.type === "custom" ? "別注ラベル" : p.kind)}】</p>
        <p className="font-brush text-[15px] group-hover:underline md:text-base">{p.name}</p>
        <p>{p.volume}</p>
        <p className="mt-auto pt-4 text-right">
          {yen(p.price)}
          <span className="text-[11px]">(税込)</span>
        </p>
      </div>
    </Link>
  );
}
