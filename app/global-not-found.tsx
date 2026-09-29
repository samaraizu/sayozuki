import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = { title: "ページが見つかりません｜小夜月" };

export default function GlobalNotFound() {
  return (
    <html lang="ja" className={`${fontVariables} antialiased`}>
      <body className="flex min-h-svh items-center justify-center bg-ink px-5 text-center text-washi">
        <main>
          <p className="font-serif text-3xl tracking-[0.4em]">小夜月</p>
          <p className="mt-8 text-sm">ページが見つかりませんでした。</p>
          <p lang="en" className="mt-2 text-xs text-washi/60">This page could not be found.</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ルートレイアウトの外なので通常のリンクにする */}
          <a href="/" className="mt-10 inline-block border border-washi/40 px-8 py-3 text-sm tracking-[0.2em]">
            トップへ / Home
          </a>
        </main>
      </body>
    </html>
  );
}
