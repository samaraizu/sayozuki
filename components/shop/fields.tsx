import type { ReactNode } from "react";

export const inputCls =
  "mt-1.5 w-full border border-line bg-white px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-green aria-[invalid=true]:border-red-600";

/** ラベル・必須マーク・エラー表示つきの入力欄の枠 */
export function Field({
  id,
  label,
  required = false,
  error,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-bold">
        {label}
        {required ? (
          <span className="bg-red-700 px-1.5 text-[10px] font-bold leading-4 text-white">必須</span>
        ) : (
          <span className="bg-sub/60 px-1.5 text-[10px] font-bold leading-4 text-white">任意</span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-sub">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
