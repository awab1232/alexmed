import type { Metadata } from "next";
import Link from "next/link";
import { BASE_OPEN_GRAPH } from "@/lib/site";
import { MarketingPage } from "@/components/landing/SiteChrome";
import s from "@/components/landing/landing.module.css";
import ls from "@/components/learn/learn.module.css";

const TITLE = "قاموس NiroLearn للمذاكرة";
const DESCRIPTION =
  "تعريفات مختصرة لمفاهيم الدراسة بالذكاء الاصطناعي: الفلاش كارد، الاسترجاع النشط، التكرار المتباعد، تلخيص PDF، الأسئلة المحمية، وغيرها.";

const TERMS = [
  {
    term: "AI study assistant",
    definition:
      "أداة تساعد الطالب على تنظيم المادة، تلخيصها، طرح أسئلة عنها، أو بناء موارد مراجعة من مصدر دراسي محدد.",
    link: "/learn/ai-study-guide",
  },
  {
    term: "Active recall",
    definition:
      "محاولة تذكّر الإجابة قبل النظر إليها. يظهر في الفلاش كارد والاختبارات الذاتية.",
    link: "/learn/flashcards-guide",
  },
  {
    term: "Spaced repetition",
    definition:
      "مراجعة المعلومة على فترات متباعدة بدل تكرارها في جلسة واحدة فقط.",
    link: "/learn/flashcards-guide",
  },
  {
    term: "PDF summarization",
    definition:
      "تحويل ملف PDF طويل إلى ملخص منظم يساعد على فهم البنية والمعلومات المهمة.",
    link: "/learn/pdf-study-guide",
  },
  {
    term: "Exam Focus",
    definition:
      "تجميع النقاط عالية الأهمية للمراجعة قبل الامتحان مع إبقاء الطالب قريبًا من مصدره الأصلي.",
    link: "/learn/exam-preparation-guide",
  },
  {
    term: "Protected question sets",
    definition:
      "مجموعات أسئلة يدرسها الطلاب داخل NiroLearn عبر وصول مخصص، وليست محتوى عامًا قابلًا للفهرسة أو التنزيل المفتوح.",
    link: "/learn/protected-question-sets",
  },
];

export const metadata: Metadata = {
  title: `${TITLE} | NiroLearn`,
  description: DESCRIPTION,
  alternates: { canonical: "/learn/glossary" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    url: "/learn/glossary",
    title: `${TITLE} | NiroLearn`,
    description: DESCRIPTION,
  },
};

export default function GlossaryPage() {
  return (
    <MarketingPage current="/learn">
      <section className={s.section} aria-labelledby="glossary-title">
        <div className={s.sectionHead}>
          <p className={s.kicker}>NiroLearn Glossary</p>
          <h1 id="glossary-title">{TITLE}</h1>
          <p>{DESCRIPTION}</p>
        </div>
        <div className={ls.articleGrid}>
          {TERMS.map(item => (
            <article key={item.term} className={ls.articleCard}>
              <h2>{item.term}</h2>
              <p>{item.definition}</p>
              <p>
                <Link href={item.link}>اقرأ أكثر</Link>
              </p>
            </article>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}
