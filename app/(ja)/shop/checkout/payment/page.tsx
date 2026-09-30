import type { Metadata } from "next";
import { CheckoutPayment } from "@/components/shop/CheckoutPayment";
import { StepBar } from "@/components/shop/StepBar";

export const metadata: Metadata = { title: "お支払い方法の選択", robots: { index: false } };

export default function PaymentPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-5 md:py-16">
      <StepBar current={2} />
      <h1 className="mb-10 text-center font-brush text-3xl font-bold md:text-4xl">お支払い方法の選択</h1>
      <CheckoutPayment />
    </div>
  );
}
