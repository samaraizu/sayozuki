import { Crest } from "@/components/ui";
import { legal } from "@/lib/shop";

/** 納品書・領収書の発行者欄 */
export function Issuer() {
  return (
    <div className="flex items-start gap-3 text-[11px] leading-5">
      <Crest className="size-12 shrink-0" />
      <div>
        <p className="text-sm font-bold">{legal.seller}</p>
        <p>{legal.address}</p>
        <p>TEL {legal.tel}　{legal.email}</p>
        <p>登録番号 {legal.invoiceNo}</p>
        <p>{legal.license}</p>
      </div>
    </div>
  );
}
