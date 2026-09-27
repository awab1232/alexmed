import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { googleEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "تسجيل الدخول | NiroLearn",
  description: "سجّل الدخول إلى NiroLearn برقم هاتفك وتابع مذاكرة ملفاتك.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
