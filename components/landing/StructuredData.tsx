// JSON-LD for the landing page. Only schemas that describe NiroLearn as it
// is: the organization, the site, the web app with its free plan (paid
// prices live in the plans table and are left out so they can't drift),
// and the FAQ exactly as shown on the page.
import { LEGAL_CONTACT_EMAIL } from "@/components/legal/LegalPage";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { LANDING_FAQ } from "./Landing";

// "<" written as its JSON escape so no string value can close the tag.
const LT_ESCAPE = "\\" + "u003c";

export default function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon.svg`,
        email: LEGAL_CONTACT_EMAIL,
        description:
          "NiroLearn منصة مذاكرة عربية بالذكاء الاصطناعي تحوّل ملفات PDF للطلاب إلى ملخصات وفلاش كارد واختبارات وخرائط ذهنية.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        inLanguage: "ar",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: SITE_DESCRIPTION,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web, Android",
        inLanguage: "ar",
        // What the product does today — the same list the page shows.
        featureList: [
          "تلخيص ملفات PDF (كتب ومحاضرات) في ملخص منظم لكل جزء",
          "Exam Focus: أهم معلومات الامتحان من الملف كاملًا مع أرقام الصفحات",
          "فلاش كارد بجدولة تكرار متباعد",
          "اختبارات اختيار من متعدد من محتوى الملف مع شرح لكل إجابة",
          "خريطة ذهنية لكل جزء من الملف",
          "مساعد دراسة يجيب بالاعتماد على صفحات الملف",
          "قارئ PDF مع تظليل وملاحظات",
          "تحويل ملفات الأسئلة السابقة إلى بطاقات مراجعة",
          "مشاركة حزمة مذاكرة مع الزملاء",
        ],
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "student",
        },
        publisher: { "@id": `${SITE_URL}/#organization` },
        offers: {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "USD",
          url: `${SITE_URL}/pricing`,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        inLanguage: "ar",
        mainEntity: LANDING_FAQ.map(item => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, LT_ESCAPE),
      }}
    />
  );
}
