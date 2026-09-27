import type { Metadata } from "next";
import RegisterForm from "@/components/RegisterForm";
import { googleEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "إنشاء حساب مجاني | NiroLearn",
  description:
    "أنشئ حسابك المجاني في NiroLearn برقم هاتفك، وارفع أول ملف لتحوّله إلى ملخص وبطاقات واختبارات.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return <RegisterForm googleEnabled={googleEnabled} />;
}
