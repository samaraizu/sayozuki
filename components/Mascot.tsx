import Image from "next/image";

/**
 * マスコット「小夜月（さよづき）くん」。三日月の頭に作務衣。
 * 飾りなので読み上げない。原画は public/images/mascot/ に置く
 */
export function Mascot({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/images/mascot/sitting.svg"
      alt=""
      aria-hidden
      width={192}
      height={250}
      priority={priority}
      unoptimized
      className={`pointer-events-none select-none ${className}`}
    />
  );
}

/** 金色の小さなきらめき（イラストの✦と同じ形） */
export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" />
    </svg>
  );
}

/** 吹き出しつきのマスコット。言葉は右、しっぽはマスコット側 */
export function MascotSays({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex items-end gap-1 ${className}`}>
      <Mascot className="h-auto w-[72px] md:w-[88px]" />
      <p className="relative mb-10 rounded-2xl border border-frost bg-white px-4 py-2.5 font-mincho text-[14px] font-bold text-navy shadow-soft before:absolute before:bottom-3 before:-left-[7px] before:size-3 before:rotate-45 before:border-b before:border-l before:border-frost before:bg-white md:text-[15px]">
        {text}
      </p>
    </div>
  );
}
