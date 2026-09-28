import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { googleEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "تسجيل الدخول | NiroLearn",
  description:
    "سجّل الدخول إلى NiroLearn برقم هاتفك أو بحساب Google، وتابع مذاكرة ملفاتك من الملخصات والبطاقات والاختبارات.",
  alternates: { canonical: "/login" },
  // A sign-in form has nothing to rank for; keep it out of the index but
  // let crawlers follow its links.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
