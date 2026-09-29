import Link from "next/link";
import { Photo } from "@/components/Photo";
import { Bottle } from "@/components/shop/Bottle";
import { products, shop } from "@/lib/shop";
import { photos, yen } from "@/lib/site";

const promises = [
  {
    title: "山形の米",
    body: "出羽燦々、雪女神、美山錦。山形で生まれ、山形の田んぼで育った酒米で醸したお酒を選んでいます。",
  },
  {
    title: "山形の水と蔵",
    body: "蔵王連峰や月山の雪どけ水に恵まれた県内の蔵から。日本酒の地理的表示（GI）「山形」にも指定された土地の酒です。",
  },
  {
    title: "宿で出している酒",
    body: "夕食の席や湯上がりの一杯として、小夜月でお出ししているものだけをお届けします。旅の余韻を、ご自宅でも。",
  },
];

export default function ShopTop() {
  return (
    <>
      {/* ファーストビュー */}
      <section className="relative bg-ink text-washi">
        <div className="absolute inset-0">
          <Photo src={photos.room} alt="宿の客室" priority className="h-full" />
        </div>
        <div className="absolute inset-0 bg-ink/65" />
        <div className="relative mx-auto max-w-6xl px-5 py-28 md:py-40">
          <p className="text-[11px] tracking-[0.4em] text-moon">YAMAGATA SAKE</p>
          <h1 className="mt-5 font-serif text-3xl leading-[1.7] tracking-[0.12em] md:text-5xl">
            宿でお出ししている
            <br />
            山形の地酒を、ご自宅へ。
          </h1>
          <p className="mt-8 max-w-lg text-[15px] leading-[2.1] text-washi/80">
            かみのやま温泉「小夜月」が、夕食の席でお出ししている日本酒をお取り寄せいただけます。山形の米と水で醸した、地産地消の酒です。
          </p>
          <Link
            href="#sake"
            className="mt-10 inline-block border border-washi/50 px-8 py-4 text-sm tracking-[0.25em] transition-colors hover:bg-washi hover:text-ink"
          >
            日本酒を見る
          </Link>
        </div>
      </section>

      {/* 地産地消 */}
      <section className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <p className="text-[11px] tracking-[0.4em] text-moon">LOCAL</p>
        <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">山形でつくり、山形で味わう</h2>
        <div className="mt-14 grid gap-px bg-ink/10 md:grid-cols-3">
          {promises.map((p, i) => (
            <div key={p.title} className="bg-washi px-2 py-8 md:px-8">
              <p className="font-serif text-4xl text-moon/60">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-4 font-serif text-lg tracking-[0.12em]">{p.title}</h3>
              <p className="mt-4 text-sm leading-[2] text-ink/70">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 商品一覧 */}
      <section id="sake" className="scroll-mt-20 bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
          <p className="text-[11px] tracking-[0.4em] text-moon">SAKE</p>
          <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">日本酒</h2>
          {products.some((p) => p.sample) && (
            <p className="mt-6 inline-block border border-moon/50 px-4 py-2 text-xs text-ink/70">
              ※ 掲載中の商品はサンプルです。実際の銘柄は準備中です。
            </p>
          )}
          <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/shop/${p.id}`} className="group block">
                  <Bottle product={p} className="aspect-[3/4] transition-opacity group-hover:opacity-85" />
                  <p className="mt-5 text-[11px] tracking-[0.2em] text-moon">
                    {p.kind}・{p.town}
                  </p>
                  <h3 className="mt-2 font-serif text-lg tracking-[0.08em]">{p.name}</h3>
                  <p className="mt-2 text-sm text-ink/70">
                    {p.volume}　<span className="tabular-nums">{yen(p.price)}</span>
                    <span className="text-xs">（税込）</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ご購入について */}
      <section className="mx-auto max-w-4xl px-5 py-24 md:py-32">
        <p className="text-[11px] tracking-[0.4em] text-moon">GUIDE</p>
        <h2 className="mt-3 font-serif text-2xl tracking-[0.15em] md:text-3xl">ご購入について</h2>
        <dl className="mt-12 divide-y divide-ink/10 border-y border-ink/10 text-sm leading-[2]">
          {[
            ["お届け", "日本国内のみのお届けです。"],
            ["送料", shop.shippingNote],
            ["お支払い", shop.paymentNote],
            ["年齢確認", "ご注文時に生年月日をお伺いします。20歳未満の方には販売いたしません。"],
          ].map(([t, d]) => (
            <div key={t} className="grid gap-2 py-6 md:grid-cols-[8rem_1fr]">
              <dt className="font-serif tracking-[0.1em]">{t}</dt>
              <dd className="text-ink/70">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
