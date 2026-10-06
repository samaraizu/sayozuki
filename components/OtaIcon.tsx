/**
 * 予約サイトのボタンに付ける線のアイコン。各社のロゴではなく、サービスの性格を表すオリジナルの図柄。
 * （ロゴは各社の商標なので、使うときは各社配布の素材をガイドラインに沿って使う）
 */
export type OtaIconName = "home" | "suitcase" | "pin";

export function OtaIcon({ name, className = "" }: { name: OtaIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-6 shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {name === "home" && (
        <>
          {/* 家：部屋を借りる */}
          <path d="M3.5 11 12 4l8.5 7" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M10 20v-5.5h4V20" />
        </>
      )}
      {name === "suitcase" && (
        <>
          {/* スーツケース：旅行の予約 */}
          <rect x="4" y="7.5" width="16" height="12" rx="1.5" />
          <path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          <path d="M4 12.5h16M10.5 12.5v2h3v-2" />
        </>
      )}
      {name === "pin" && (
        <>
          {/* 地図のピン：観光・宿探し */}
          <path d="M12 20.5s6-5.6 6-10.5a6 6 0 1 0-12 0c0 4.9 6 10.5 6 10.5z" />
          <circle cx="12" cy="10" r="2.2" />
        </>
      )}
    </svg>
  );
}
