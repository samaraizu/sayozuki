import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate } from "@/components/shop/AgeGate";
import { CartLink } from "@/components/shop/CartLink";
import { shop } from "@/lib/shop";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: `${shop.name}｜山形の地酒`, template: `%s｜${shop.name}` },
  description:
    "かみのやま温泉の宿「小夜月」でお出ししている厳選した山形の地酒を、ご自宅へお届けします。山形の米と水で醸した、地産地消の日本酒。",
};

export default function ShopLayout({ children }: LayoutProps<"/shop">) {
  return (
    <>
      <AgeGate />
      <header className="sticky top-0 z-50 bg-ink text-washi">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/shop" className="leading-tight">
            <span className="block font-serif text-lg tracking-[0.3em]">{site.name}</span>
            <span className="block text-[10px] tracking-[0.3em] text-washi/60">お取り寄せ</span>
          </Link>
          <nav className="flex items-center gap-5 text-[13px] tracking-[0.12em]">
            <Link href="/shop#sake" className="hidden opacity-80 hover:opacity-100 sm:block">
              日本酒
            </Link>
            <Link href="/" className="hidden opacity-80 hover:opacity-100 sm:block">
              宿のご案内
            </Link>
            <CartLink />
          </nav>
        </div>
      </header>

      <div className="bg-moon/15 px-5 py-2 text-center text-[11px] tracking-[0.1em] text-ink/70">
        20歳未満の者の飲酒は法律で禁止されています。20歳未満の方には酒類を販売いたしません。
      </div>

      <main className="min-h-[60vh]">{children}</main>

      <footer className="bg-ink px-5 py-12 text-washi/60">
        <div className="mx-auto max-w-6xl text-xs leading-7 tracking-[0.08em]">
          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-washi/80">
            <Link href="/shop">お取り寄せトップ</Link>
            <Link href="/shop/cart">カート</Link>
            <Link href="/shop/legal">特定商取引法に基づく表記・酒類販売管理者標識</Link>
            <Link href="/">小夜月 宿のご案内</Link>
          </nav>
          <p className="mt-8">
            20歳未満の者の飲酒は法律で禁止されています。妊娠中や授乳期の飲酒は、胎児・乳児の発育に悪影響を与えるおそれがあります。
          </p>
          <p className="mt-4">
            運営：{site.company}　{site.postalCode} {site.address}
          </p>
        </div>
      </footer>
    </>
  );
}
