import type { Metadata } from "next";
import { CartView } from "@/components/shop/CartView";
import { StepBar } from "@/components/shop/StepBar";

export const metadata: Metadata = { title: "カート" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-5 md:py-16">
      <StepBar current={0} />
      <h1 className="mb-10 font-brush text-3xl font-bold md:text-4xl">カート</h1>
      <CartView />
    </div>
  );
}
