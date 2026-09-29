import type { Metadata } from "next";
import Link from "next/link";
import { AgeGate } from "@/components/shop/AgeGate";
import { CartLink } from "@/components/shop/CartLink";
import { Crest } from "@/components/ui";
import { shop } from "@/lib/shop";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: `${shop.name}｜山形の地酒`, template: `%s｜${shop.name}` },
  description:
    "かみのやま温泉の宿「小夜月」でお出ししている厳選した山形の地酒を、ご自宅へお届けします。山形の米と水で醸した、地産地消の日本酒。",
};

const nav = [
  ["/shop#lineup", "日本酒"],
  ["/shop#taste", "テイストマップ"],
  ["/shop#local", "山形の地酒について"],
  ["/shop#guide", "ご購入について"],
  ["/", "宿のご案内"],
] as const;

export default function ShopLayout({ children }: LayoutProps<"/shop">) {
  return (
    <>
      <AgeGate />
      <p className="bg-green-soft px-4 py-1.5 text-center text-[12px] font-bold text-green md:text-[13px]">
        かみのやま温泉「小夜月」でお出ししている山形の地酒をお届けします
      </p>

      <header className="relative z-40 bg-white">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:h-20 md:px-5">
          <Link href="/shop" className="flex items-center gap-3">
            <Crest className="size-11 md:size-14" />
            <span className="leading-tight">
              <span className="block font-serif-ja text-lg tracking-[0.2em]">{site.name}</span>
              <span className="block font-brush text-[13px] text-sub">お取り寄せ</span>
            </span>
          </Link>
          <div className="flex items-end gap-2">
            <Link href="/" className="flex flex-col items-center gap-0.5 px-2 text-[10px]" aria-label="宿のご案内">
              <svg viewBox="0 0 28 28" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M3 13L14 4l11 9M6 11v13h16V11M11 24v-7h6v7" />
              </svg>
              <span className="hidden md:block">宿のご案内</span>
            </Link>
            <CartLink />
          </div>
        </div>
        <nav className="border-y border-line">
          <ul className="mx-auto flex max-w-6xl justify-between gap-6 overflow-x-auto px-4 text-[13px] whitespace-nowrap md:px-5 md:text-[15px]">
            {nav.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="block py-3.5 hover:text-green md:py-4">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="bg-green px-4 py-2 text-center text-[11px] font-bold text-white md:text-[13px]">
          20歳未満の者の飲酒は法律で禁止されています。20歳未満の方には酒類を販売いたしません。
        </p>
      </header>

      <main className="min-h-[60vh]">{children}</main>

      <footer className="bg-surface px-4 pt-14 pb-10 md:px-5">
        <div className="mx-auto max-w-6xl text-[13px] leading-7">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <Link href="/shop" className="flex items-center gap-3">
              <Crest className="size-12" />
              <span className="font-serif-ja text-lg tracking-[0.2em]">{site.name}</span>
            </Link>
            <nav className="grid grid-cols-2 gap-x-10 gap-y-2 md:grid-cols-3">
              <Link href="/shop#lineup" className="hover:text-green">日本酒ラインナップ</Link>
              <Link href="/shop#taste" className="hover:text-green">テイストマップ</Link>
              <Link href="/shop/cart" className="hover:text-green">カート</Link>
              <Link href="/shop/legal" className="hover:text-green">特定商取引法に基づく表記</Link>
              <Link href="/shop/legal#manager" className="hover:text-green">酒類販売管理者標識</Link>
              <Link href="/" className="hover:text-green">宿のご案内</Link>
            </nav>
          </div>
          <p className="mt-12 border-t border-line pt-8 text-xs leading-6 text-sub">
            20歳未満の者の飲酒は法律で禁止されています。妊娠中や授乳期の飲酒は、胎児・乳児の発育に悪影響を与えるおそれがあります。
          </p>
          <p className="mt-2 text-xs text-sub">
            運営：{site.company}　{site.postalCode} {site.address}
          </p>
        </div>
      </footer>
    </>
  );
}
