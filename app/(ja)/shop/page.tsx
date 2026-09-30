import Link from "next/link";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { TasteMap } from "@/components/shop/TasteMap";
import { Chip, Crest, MoreLink, PhotoBand, SectionHeading } from "@/components/ui";
import { allTags, delivery, products, shop, tagsOf, type Product } from "@/lib/shop";
import { photos } from "@/lib/site";

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
    title: "宿でお出ししている厳選したお酒",
    body: "夕食の席や湯上がりの一杯として、小夜月でお出ししているものだけをお届けします。旅の余韻を、ご自宅でも。",
  },
];

function Band({
  id,
  image,
  alt,
  title,
  lead,
  tags,
  items,
  more,
}: {
  id?: string;
  image: string;
  alt: string;
  title: string;
  lead: string;
  tags: string[];
  items: Product[];
  more?: { href: string; label: string };
}) {
  return (
    <section id={id} className="scroll-mt-4 pb-16 md:pb-20">
      <PhotoBand image={image} alt={alt} title={title} lead={lead}>
        <div className="relative mt-8 flex flex-wrap justify-center gap-2 px-4">
          {tags.map((t) => (
            <Chip key={t} href={`/shop?tag=${encodeURIComponent(t)}#lineup`}>
              #{t}
            </Chip>
          ))}
        </div>
        <ProductGrid items={items} className="mt-10" />
      </PhotoBand>
      {more && (
        <div className="mx-auto mt-10 flex max-w-6xl justify-end px-4 md:px-5">
          <MoreLink href={more.href}>{more.label}</MoreLink>
        </div>
      )}
    </section>
  );
}

export default async function ShopTop({ searchParams }: PageProps<"/shop">) {
  const raw = (await searchParams).tag;
  const tag = typeof raw === "string" && allTags.includes(raw) ? raw : null;
  const lineup = tag ? products.filter((p) => tagsOf(p).includes(tag)) : products;
  const gifts = products.filter((p) => tagsOf(p).includes("贈りもの") || p.kind.includes("吟醸"));
  const everyday = products.filter((p) => p.taste.dry >= 3 || ["本醸造", "特別純米"].includes(p.kind));

  return (
    <>
      {/* ファーストビュー */}
      <section className="relative h-[70svh] min-h-[440px] overflow-hidden md:h-[640px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 背景の写真 */}
        <img src={photos.room} alt="宿の客室" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
        <div className="relative mx-auto flex h-full max-w-6xl items-center px-6 md:px-10">
          <div className="text-white">
            <p className="font-en text-2xl font-medium tracking-[0.08em] md:text-4xl">YAMAGATA SAKE</p>
            <div className="mt-6 flex items-center gap-5">
              <Crest tone="white" className="size-20 md:size-28" />
              <h1 className="font-brush text-3xl font-bold leading-[1.6] md:text-5xl">
                宿でお出ししている
                <br />
                厳選した山形の地酒
              </h1>
            </div>
            <p className="mt-6 font-brush text-base md:text-xl">かみのやま温泉 小夜月</p>
          </div>
        </div>
      </section>

      {/* ラインナップ */}
      <section id="lineup" className="scroll-mt-4 pt-20 md:pt-24">
        <SectionHeading en="LINEUP" ja="日本酒ラインナップ" />
        {products.some((p) => p.sample) && (
          <p className="-mt-6 mb-10 text-center text-xs text-sub">※ 掲載中の商品はサンプルです。実際の銘柄は準備中です。</p>
        )}
        {tag && (
          <p className="mb-8 text-center text-sm">
            <span className="font-bold text-green">#{tag}</span> のお酒（{lineup.length}件）
            <Link href="/shop#lineup" scroll={false} className="ml-4 text-sub underline underline-offset-4">
              すべて表示
            </Link>
          </p>
        )}
        <Band
          image={photos.room}
          alt="宿の客室"
          title="宿でお出ししている厳選したお酒"
          lead="山形の米と水で醸した、地産地消の酒"
          tags={allTags}
          items={lineup}
        />
        {!tag && (
          <>
            <Band
              image={photos.lobby}
              alt="宿のロビー"
              title="贈りものにおすすめのお酒"
              lead="大切な方へ、山形の旅の便りを"
              tags={["純米大吟醸", "純米吟醸", "贈りもの"].filter((t) => allTags.includes(t))}
              items={gifts}
              more={{ href: "/shop?tag=贈りもの#lineup", label: "贈りものにおすすめのお酒" }}
            />
            <Band
              image={photos.onsen}
              alt="宿の大浴場"
              title="湯上がりの晩酌に"
              lead="毎日の食卓に寄り添う、いつもの一杯"
              tags={["辛口", "本醸造", "特別純米", "一升瓶"].filter((t) => allTags.includes(t))}
              items={everyday}
              more={{ href: "/shop?tag=辛口#lineup", label: "辛口のお酒" }}
            />
          </>
        )}
      </section>

      {/* テイストマップ */}
      <section id="taste" className="scroll-mt-4 px-4 py-20 md:py-24">
        <SectionHeading en="TASTE MAP" ja="日本酒テイストマップ" />
        <TasteMap />
      </section>

      {/* 山形の地酒について */}
      <section id="local" className="scroll-mt-4 bg-surface px-4 py-20 md:py-24">
        <SectionHeading en="LOCAL" ja="山形でつくり、山形で味わう" />
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {promises.map((p, i) => (
            <div key={p.title} className="bg-white px-7 py-9">
              <p className="font-en text-3xl font-medium text-green">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 font-brush text-xl font-bold">{p.title}</h3>
              <p className="mt-4 text-sm leading-7 text-sub">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ご購入について */}
      <section id="guide" className="scroll-mt-4 px-4 py-20 md:py-24">
        <SectionHeading en="GUIDE" ja="ご購入について" />
        <dl className="mx-auto max-w-3xl divide-y divide-line border-y border-line text-sm leading-7">
          {[
            ["お届け", "日本国内のみのお届けです。"],
            ["受け取り方法", `${delivery.method}。${delivery.methodNote}`],
            ["送料", shop.shippingNote],
            ["お支払い", shop.paymentNote],
            ["年齢確認", "ご注文時に生年月日をお伺いします。20歳未満の方には販売いたしません。"],
          ].map(([t, d]) => (
            <div key={t} className="grid gap-1 py-5 md:grid-cols-[9rem_1fr]">
              <dt className="font-bold">{t}</dt>
              <dd className="text-sub">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
