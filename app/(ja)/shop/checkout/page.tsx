import type { Metadata } from "next";
import { CheckoutInfo } from "@/components/shop/CheckoutInfo";
import { StepBar } from "@/components/shop/StepBar";

export const metadata: Metadata = { title: "お届け先の入力", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-5 md:py-16">
      <StepBar current={1} />
      <h1 className="mb-10 text-center font-brush text-3xl font-bold md:text-4xl">お届け先の入力</h1>
      <CheckoutInfo />
    </div>
  );
}
