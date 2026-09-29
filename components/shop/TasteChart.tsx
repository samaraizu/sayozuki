import type { Product } from "@/lib/shop";

function Scale({ left, right, value }: { left: string; right: string; value: number }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-3 text-xs text-ink/60">
      <span>{left}</span>
      <div className="relative h-px bg-ink/20">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-ink/25"
            style={{ left: `${i * 25}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-moon"
          style={{ left: `${value * 25}%` }}
        />
      </div>
      <span className="text-right">{right}</span>
    </div>
  );
}

export function TasteChart({ taste }: { taste: Product["taste"] }) {
  return (
    <div className="space-y-4" aria-label={`甘辛 ${taste.dry}/4、濃淡 ${taste.body}/4`}>
      <Scale left="甘口" right="辛口" value={taste.dry} />
      <Scale left="淡麗" right="濃醇" value={taste.body} />
    </div>
  );
}
