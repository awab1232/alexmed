import "@/app/globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, {
  LEGAL_APP_NAME,
  LEGAL_CONTACT_EMAIL,
  type LegalSection,
} from "@/components/legal/LegalPage";

// Public contact page (linked from the landing footer). Only real channels:
// the same contact email as the privacy policy and terms.
export const metadata: Metadata = {
  title: `تواصل معنا | ${LEGAL_APP_NAME}`,
  description: `تواصل مع فريق ${LEGAL_APP_NAME} بخصوص حسابك أو ملفاتك أو اشتراكك، أو لأي سؤال واقتراح حول منصة المذاكرة بالذكاء الاصطناعي.`,
  alternates: { canonical: "/contact" },
};

const email = (
  <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} dir="ltr">
    {LEGAL_CONTACT_EMAIL}
  </a>
);

const sections: LegalSection[] = [
  {
    id: "email",
    title: "راسلنا",
    body: (
      <p>
        لأي سؤال أو ملاحظة أو مشكلة تقنية، راسلنا على {email}. اذكر رقم الهاتف
        المرتبط بحسابك إن كان سؤالك عن الحساب.
      </p>
    ),
  },
  {
    id: "account",
    title: "حسابك وبياناتك",
    body: (
      <p>
        يمكنك حذف حسابك وكل ملفاتك من صفحة الحساب داخل التطبيق. ولمعرفة كيف
        نتعامل مع بياناتك، اقرأ <Link href="/privacy">سياسة الخصوصية</Link>.
      </p>
    ),
  },
  {
    id: "plans",
    title: "الخطط والاشتراك",
    body: (
      <p>
        تفاصيل الخطط وحدود كل منها في <Link href="/pricing">صفحة الأسعار</Link>،
        ولأي سؤال عن اشتراكك راسلنا على {email}.
      </p>
    ),
  },
];

export default function ContactPage() {
  return (
    <LegalPage
      title="تواصل معنا"
      intro={
        <p>
          نسعد بسماع أسئلتك واقتراحاتك حول {LEGAL_APP_NAME}، ونرد عادةً عبر
          البريد الإلكتروني.
        </p>
      }
      sections={sections}
    />
  );
}
