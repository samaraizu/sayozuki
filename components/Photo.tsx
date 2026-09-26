import Image from "next/image";

/**
 * 写真の枠。src が未設定のあいだは、撮影方針のメモを添えた仮の面を出す。
 */
export function Photo({
  src,
  alt,
  className = "",
  priority = false,
  sizes = "100vw",
}: {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-dusk ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-end bg-[radial-gradient(ellipse_at_70%_20%,#3a3d48_0%,#22242b_60%)] p-4">
          <span className="text-[11px] tracking-[0.2em] text-washi/40">{alt}</span>
        </div>
      )}
    </div>
  );
}
