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
    <div className="mx-auto max-w-6xl px-5 py-12 md:py-20">
      <nav className="text-xs text-ink/50" aria-label="パンくず">
        <Link href="/shop" className="hover:underline">
          お取り寄せ
        </Link>
        <span className="mx-2">/</span>
        <Link href="/shop#sake" className="hover:underline">
          日本酒
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink/70">{p.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-16">
        <Bottle product={p} className="aspect-square md:aspect-[4/5]" />

        <div>
          <p className="text-[11px] tracking-[0.25em] text-moon">
            {p.kind}・山形県{p.town}
          </p>
          <h1 className="mt-3 font-serif text-3xl tracking-[0.08em]">{p.name}</h1>
          <p className="mt-5 text-2xl tabular-nums">
            {yen(p.price)}
            <span className="ml-1 text-xs text-ink/60">（税込・送料別）</span>
          </p>
          {p.sample && <p className="mt-3 text-xs text-ink/50">※ サンプル商品です</p>}

          <p className="mt-8 text-[15px] leading-[2.1] text-ink/80">{p.description}</p>

          <div className="mt-10">
            <AddToCart id={p.id} />
            {!shop.open && (
              <p className="mt-3 text-xs text-ink/50">※ 現在は販売準備中のため、ご注文の確定はできません。</p>
            )}
          </div>

          <div className="mt-12 border-t border-ink/10 pt-10">
            <h2 className="text-xs tracking-[0.25em] text-ink/60">味わい</h2>
            <div className="mt-5">
              <TasteChart taste={p.taste} />
            </div>
            <p className="mt-6 text-sm leading-7 text-ink/70">
              <span className="mr-2 text-moon">合う料理</span>
              {p.pairing}
            </p>
          </div>

          <dl className="mt-10 divide-y divide-ink/10 border-y border-ink/10 text-sm">
            {specs.map(([t, d]) => (
              <div key={t} className="grid grid-cols-[7rem_1fr] py-3">
                <dt className="text-ink/60">{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
