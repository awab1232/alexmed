import type { LearnCategory } from "./articles";

export type LearnTopic = {
  id: LearnCategory;
  title: string;
  description: string;
};

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: "brand",
    title: "NiroLearn",
    description: "تعريف رسمي ومنظم للمنصة وما تفعله للطلاب.",
  },
  {
    id: "ai-study",
    title: "الدراسة بالذكاء الاصطناعي",
    description: "طرق استخدام AI في الفهم، التنظيم، والمراجعة دون الاعتماد الأعمى.",
  },
  {
    id: "pdf-study",
    title: "مذاكرة ملفات PDF",
    description: "تحويل الكتب والمحاضرات الطويلة إلى خطة مذاكرة عملية.",
  },
  {
    id: "flashcards",
    title: "الفلاش كارد والمراجعة",
    description: "الاسترجاع النشط، التكرار المتباعد، وتحسين البطاقات.",
  },
  {
    id: "exam-prep",
    title: "التحضير للامتحان",
    description: "أسئلة، اختبارات، Exam Focus، وخطط مراجعة واقعية.",
  },
  {
    id: "games",
    title: "الألعاب التعليمية",
    description: "استخدام الألعاب القصيرة كتدريب واستراحة ذكية أثناء الدراسة.",
  },
  {
    id: "protected-sets",
    title: "مجموعات الأسئلة المحمية",
    description: "شرح عام وآمن لتدفقات الأسئلة المحمية للمدرسين والطلاب.",
  },
];

export const LEARN_TOPIC_BY_ID = new Map(LEARN_TOPICS.map(topic => [topic.id, topic]));
