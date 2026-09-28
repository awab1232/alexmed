import "@/app/globals.css";
import type { Metadata } from "next";

// /pricing is a client page, so its metadata lives here.
export const metadata: Metadata = {
  title: "الأسعار والخطط | NiroLearn",
  description:
    "خطط NiroLearn: ابدأ مجانًا، أو اختر Pro أو Ultimate لحدود استخدام أعلى في رفع الملفات ومساعد الدراسة.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
