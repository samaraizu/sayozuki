import type { Metadata } from "next";
import { dictionaries } from "@/lib/i18n";
import { fontVariables } from "@/lib/fonts";
import { site } from "@/lib/site";
import "../globals.css";

const t = dictionaries.ja;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: t.meta.title,
  description: t.meta.description,
  openGraph: { title: t.meta.title, description: t.meta.description, locale: "ja_JP", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${fontVariables} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
