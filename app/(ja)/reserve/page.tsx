import type { Metadata } from "next";
import { ReservePage } from "@/components/ReservePage";
import { dictionaries } from "@/lib/i18n";

export const metadata: Metadata = {
  title: `${dictionaries.ja.book.title}｜${dictionaries.ja.meta.title}`,
  alternates: { canonical: "/reserve" },
};

export default function Reserve() {
  return <ReservePage lang="ja" />;
}
