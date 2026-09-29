import type { Metadata } from "next";
import { CheckoutForm } from "@/components/shop/CheckoutForm";

export const metadata: Metadata = { title: "カート・ご注文" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <h1 className="font-brush text-3xl font-bold md:text-4xl">カート・ご注文</h1>
      <div className="mt-12">
        <CheckoutForm />
      </div>
    </div>
  );
}
