"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="bg-green px-6 py-2.5 text-sm font-bold text-white print:hidden">
      印刷する / PDFに保存
    </button>
  );
}
