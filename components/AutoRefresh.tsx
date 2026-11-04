"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 決済の確認待ちのあいだ、画面を読み直す（5分でやめる） */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (n * seconds > 300) return clearInterval(id);
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
