import { Noto_Sans_JP, Roboto, Shippori_Mincho, Yuji_Syuku } from "next/font/google";

export const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const shippori = Shippori_Mincho({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** 筆で書いた楷書体。見出し・屋号・商品名に使う */
export const yuji = Yuji_Syuku({
  variable: "--font-yuji",
  subsets: ["latin"],
  weight: "400",
});

export const fontVariables = `${notoSans.variable} ${shippori.variable} ${roboto.variable} ${yuji.variable}`;
