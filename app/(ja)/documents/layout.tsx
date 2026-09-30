import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

/** 帳票のフォーマット案。画面ではグレーの台紙に A4 を載せ、印刷時は A4 だけを出す */
export default function DocumentsLayout({ children }: LayoutProps<"/documents">) {
  return (
    <div className="min-h-svh bg-surface py-10 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0; }`}</style>
      {children}
    </div>
  );
}
