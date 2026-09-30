const steps = ["カート", "お届け先", "お支払い方法", "ご注文内容の確認", "ご注文完了"];

/** ご注文手続きの現在地。current は 0 始まり */
export function StepBar({ current }: { current: number }) {
  return (
    <ol className="mx-auto mb-12 flex max-w-3xl items-start" aria-label="ご注文の手順">
      {steps.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === current ? "step" : undefined}>
          {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${i <= current ? "bg-green" : "bg-line"}`} />}
          <span
            className={`relative z-10 flex size-8 items-center justify-center rounded-full font-en text-sm ${
              i < current ? "bg-green text-white" : i === current ? "bg-green text-white ring-4 ring-green-soft" : "bg-line text-sub"
            }`}
          >
            {i + 1}
          </span>
          <span className={`mt-2 text-[11px] leading-tight md:text-[13px] ${i === current ? "font-bold text-green" : "text-sub"}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
