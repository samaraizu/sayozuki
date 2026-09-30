import type { Metadata } from "next";
import { CheckoutConfirm } from "@/components/shop/CheckoutConfirm";
import { StepBar } from "@/components/shop/StepBar";

export const metadata: Metadata = { title: "ご注文内容の確認", robots: { index: false } };

export default function ConfirmPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-5 md:py-16">
      <StepBar current={3} />
      <h1 className="mb-10 text-center font-brush text-3xl font-bold md:text-4xl">ご注文内容の確認</h1>
      <CheckoutConfirm />
    </div>
  );
}
