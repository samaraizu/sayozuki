import type { Product } from "@/lib/shop";

/** 商品写真が入るまでの仮の瓶。ラベルに銘柄を縦書きで入れる */
export function Bottle({ product, className = "" }: { product: Product; className?: string }) {
  const tall = product.volume === "1800ml";
  return (
    <div className={`flex items-end justify-center bg-paper ${className}`}>
      <svg
        viewBox="0 0 120 320"
        className={tall ? "h-[88%]" : "h-[76%]"}
        role="img"
        aria-label={`${product.name} ${product.volume}`}
      >
        <path
          d="M50 8h20v58c0 10 26 26 26 58v180c0 6-4 10-10 10H34c-6 0-10-4-10-10V124c0-32 26-48 26-58z"
          fill={product.color}
        />
        <rect x="48" y="4" width="24" height="16" rx="2" fill="#a8894f" />
        <rect x="32" y="150" width="56" height="120" fill="#f5f2ea" />
        <text
          x="60"
          y="162"
          fill="#1c1d22"
          fontSize="13"
          fontFamily="var(--font-shippori), serif"
          writingMode="vertical-rl"
          letterSpacing="3"
          textAnchor="start"
        >
          {product.name.split(" ").pop()}
        </text>
      </svg>
    </div>
  );
}
