import type { Metadata } from "next";
import { Noto_Sans_JP, Shippori_Mincho } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const shippori = Shippori_Mincho({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const description =
  "山形・かみのやま温泉の湯宿「小夜月」。静けさと余白のなかで、塩化物・硫酸塩の湯にゆっくりと浸かる一夜を。";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name}（${site.kana}）｜${site.tagline}`,
  description,
  openGraph: {
    title: `${site.name}｜${site.tagline}`,
    description,
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSans.variable} ${shippori.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
