"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "sayozuki-age-ok";

/** お取り寄せの入口での年齢確認。確認済みはこのブラウザのセッション中だけ覚える */
export function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ok = false;
    try {
      ok = sessionStorage.getItem(KEY) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 保存値はブラウザでしか読めない
    if (!ok) setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-5"
    >
      <div className="w-full max-w-sm bg-white px-8 py-10 text-center shadow-xl">
        <p className="font-en text-2xl font-medium">AGE CHECK</p>
        <h2 id="age-title" className="mt-4 font-brush text-2xl font-bold">
          あなたは20歳以上ですか？
        </h2>
        <p className="mt-4 text-xs leading-6 text-sub">
          このページでは酒類を販売しています。
          <br />
          20歳未満の方への販売はいたしません。
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link href="/" className="border border-line py-3 text-sm">
            いいえ
          </Link>
          <button
            type="button"
            autoFocus
            onClick={() => {
              try {
                sessionStorage.setItem(KEY, "1");
              } catch {}
              setOpen(false);
            }}
            className="bg-green py-3 text-sm font-bold text-white"
          >
            はい
          </button>
        </div>
      </div>
    </div>
  );
}
