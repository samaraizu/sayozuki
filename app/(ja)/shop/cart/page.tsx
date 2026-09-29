import type { Metadata } from "next";
import { CheckoutForm } from "@/components/shop/CheckoutForm";

export const metadata: Metadata = { title: "カート・ご注文" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <h1 className="font-serif text-2xl tracking-[0.15em] md:text-3xl">カート・ご注文</h1>
      <div className="mt-12">
        <CheckoutForm />
      </div>
    </div>
  );
}
