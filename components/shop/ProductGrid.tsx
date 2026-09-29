import { ProductCard } from "@/components/shop/ProductCard";
import type { Product } from "@/lib/shop";

/** 帯に重ねる商品の並び。数が少なくても中央に寄せる */
export function ProductGrid({ items, className = "" }: { items: Product[]; className?: string }) {
  return (
    <ul className={`relative mx-auto flex max-w-6xl flex-wrap justify-center gap-x-1 gap-y-8 px-4 md:px-5 ${className}`}>
      {items.map((p) => (
        <li key={p.id} className="w-[calc(50%-2px)] sm:w-[calc(33.333%-3px)] md:w-[206px]">
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
