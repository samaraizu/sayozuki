import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/shop/AddToCart";
import { Bottle } from "@/components/shop/Bottle";
import { TasteChart } from "@/components/shop/TasteChart";
import { findProduct, products, shop } from "@/lib/shop";
import { yen } from "@/lib/site";

export function generateStaticParams() {
  return products.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/shop/[id]">): Promise<Metadata> {
  const p = findProduct((await params).id);
  return p ? { title: p.name, description: p.description } : {};
}

export default async function ProductPage({ params }: PageProps<"/shop/[id]">) {
  const p = findProduct((await params).id);
  if (!p) notFound();

  const specs = [
    ["種類", p.kind],
    ["蔵元", `${p.brewery}（山形県${p.town}）`],
    ["原料米", p.rice],
    ["精米歩合", p.polish],
    ["アルコール分", p.abv],
    ["容量", p.volume],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-5 md:py-16">
      <nav className="text-xs text-sub" aria-label="パンくず">
        <Link href="/shop" className="hover:underline">
          お取り寄せ
        </Link>
        <span className="mx-2">/</span>
        <Link href="/shop#sake" className="hover:underline">
          日本酒
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{p.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-16">
        <Bottle product={p} className="aspect-square bg-surface md:aspect-[4/5]" />

        <div>
          <p className="text-[11px] text-moon">
            {p.kind}・山形県{p.town}
          </p>
          <h1 className="mt-3 text-2xl font-bold md:text-3xl">{p.name}</h1>
          <p className="mt-5 text-2xl tabular-nums">
            {yen(p.price)}
            <span className="ml-1 text-xs text-sub">（税込・送料別）</span>
          </p>
          {p.sample && <p className="mt-3 text-xs text-sub">※ サンプル商品です</p>}

          <p className="mt-8 text-[15px] leading-[2.1] text-ink">{p.description}</p>

          <div className="mt-10">
            <AddToCart id={p.id} />
            {!shop.open && (
              <p className="mt-3 text-xs text-sub">※ 現在は販売準備中のため、ご注文の確定はできません。</p>
            )}
          </div>

          <div className="mt-12 border-t border-line pt-10">
            <h2 className="text-xs text-sub">味わい</h2>
            <div className="mt-5">
              <TasteChart taste={p.taste} />
            </div>
            <p className="mt-6 text-sm leading-7 text-ink">
              <span className="mr-2 text-moon">合う料理</span>
              {p.pairing}
            </p>
          </div>

          <dl className="mt-10 divide-y divide-line border-y border-line text-sm">
            {specs.map(([t, d]) => (
              <div key={t} className="grid grid-cols-[7rem_1fr] py-3">
                <dt className="text-sub">{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
