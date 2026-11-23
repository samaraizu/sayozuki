import Image from "next/image";

/**
 * マスコット「小夜月（さよづき）くん」。三日月の頭に作務衣。
 * 飾りなので読み上げない。原画は public/images/mascot/
 * sitting だけ SVG。ほかはキャラクターシートから切り抜いた PNG（背景透過）で、
 * フチに生成りが少し残るため、生成り・白の地の上で使う
 */
const poses = {
  sitting: { src: "/images/mascot/sitting.svg", w: 192, h: 250 }, // おすわり（茶）
  odekake: { src: "/images/mascot/odekake.png", w: 220, h: 236 }, // 提灯でおでかけ
  oyasumi: { src: "/images/mascot/oyasumi.png", w: 249, h: 157 }, // 座布団でおやすみ
  onsen: { src: "/images/mascot/onsen.png", w: 295, h: 213 }, // 温泉
  nonbiri: { src: "/images/mascot/nonbiri.png", w: 211, h: 205 }, // お茶でのんびり
  heart: { src: "/images/mascot/heart.png", w: 136, h: 145 }, // ハート
  peek: { src: "/images/mascot/peek.png", w: 101, h: 153 }, // 柱からのぞく
} as const;

export type MascotPose = keyof typeof poses;

export function Mascot({ pose = "sitting", className = "", priority = false }: { pose?: MascotPose; className?: string; priority?: boolean }) {
  const p = poses[pose];
  return (
    <Image
      src={p.src}
      alt=""
      aria-hidden
      width={p.w}
      height={p.h}
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
export function MascotSays({ text, pose = "sitting", className = "" }: { text: string; pose?: MascotPose; className?: string }) {
  return (
    <div className={`flex items-end gap-1 ${className}`}>
      <Mascot pose={pose} className="h-auto w-[84px] md:w-[100px]" />
      <p className="relative mb-10 rounded-2xl border border-frost bg-white px-4 py-2.5 font-mincho text-[14px] font-bold text-navy shadow-soft before:absolute before:bottom-3 before:-left-[7px] before:size-3 before:rotate-45 before:border-b before:border-l before:border-frost before:bg-white md:text-[15px]">
        {text}
      </p>
    </div>
  );
}
