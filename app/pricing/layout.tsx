import "@/app/globals.css";
import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/site";

// /pricing is a client page, so its metadata lives here.
export const metadata: Metadata = {
  title: "الأسعار والخطط | NiroLearn",
  description:
    "خطط NiroLearn: ابدأ مجانًا، أو اختر Pro أو Ultimate لحدود استخدام أعلى في رفع الملفات ومساعد الدراسة.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    url: "/pricing",
    title: "الأسعار والخطط | NiroLearn",
    description:
      "خطط NiroLearn: ابدأ مجانًا، أو اختر Pro أو Ultimate لحدود استخدام أعلى في رفع الملفات ومساعد الدراسة.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
