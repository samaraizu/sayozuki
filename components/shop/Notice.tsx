/** 酒類の通信販売で必要な注意書き。商品ページ・カート・確認画面に出す */
export function AgeNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`border border-green/30 bg-green-soft px-4 py-3 text-[13px] leading-6 text-green ${className}`}>
      20歳未満の者の飲酒は法律で禁止されています。20歳未満の方には酒類を販売いたしません。
    </p>
  );
}
