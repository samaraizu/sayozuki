import { Noto_Sans_JP, Roboto, Shippori_Mincho } from "next/font/google";

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

export const fontVariables = `${notoSans.variable} ${shippori.variable} ${roboto.variable}`;
