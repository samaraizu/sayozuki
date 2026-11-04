import type { Metadata } from "next";
import { ReserveDone } from "@/components/ReserveDone";

export const metadata: Metadata = { robots: { index: false } };

export default async function Done({ searchParams }: PageProps<"/reserve/done">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <ReserveDone lang="ja" no={one(sp.no)} keyParam={one(sp.key)} />;
}
