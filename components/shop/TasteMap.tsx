import Link from "next/link";
import { Bottle } from "@/components/shop/Bottle";
import { products } from "@/lib/shop";
import { shopPath } from "@/lib/urls";

/**
 * 日本酒テイストマップ。縦が辛口↔甘口、横が濃醇↔淡麗。
 * 商品の taste（0〜4）から位置を決める。
 */
export function TasteMap() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative border-4 border-line bg-white px-10 py-12 md:px-16">
        <p className="text-center font-brush text-xl font-bold tracking-[0.3em] text-sub md:text-2xl">辛口</p>
        <div className="relative mx-auto my-4 aspect-[4/3] w-full">
          {/* 軸 */}
          <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
          <span className="absolute left-0 top-1/2 h-px w-full bg-line" />
          <span className="absolute -left-9 top-1/2 -translate-y-1/2 font-brush text-xl font-bold leading-tight text-sub [writing-mode:vertical-rl] md:-left-12 md:text-xl">
            濃醇
          </span>
          <span className="absolute -right-9 top-1/2 -translate-y-1/2 font-brush text-xl font-bold leading-tight text-sub [writing-mode:vertical-rl] md:-right-12 md:text-xl">
            淡麗
          </span>
          {products.map((p) => {
            // body 4（濃醇）が左、0（淡麗）が右。dry 4（辛口）が上
            const left = 10 + ((4 - p.taste.body) / 4) * 80;
            const top = 8 + ((4 - p.taste.dry) / 4) * 76;
            return (
              <Link
                key={p.id}
                href={shopPath(`/${p.id}`)}
                className="group absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center md:w-24"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <Bottle product={p} className="h-14 w-10 md:h-16 md:w-12" />
                <span className="mt-1 text-center font-brush text-xs font-bold leading-4 group-hover:underline md:text-sm">
                  {p.name.split(" ").pop()}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="text-center font-brush text-xl font-bold tracking-[0.3em] text-sub md:text-2xl">甘口</p>
      </div>
      <p className="mt-4 text-center text-xs font-bold">商品ページにジャンプします</p>
    </div>
  );
}
