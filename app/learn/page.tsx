import type { Metadata } from "next";
import { BASE_OPEN_GRAPH } from "@/lib/site";
import { INDEXABLE_LEARN_ARTICLES } from "@/content/learn/articles";
import { LearnIndex } from "@/components/learn/LearnPage";

const TITLE = "Learn | مركز معرفة NiroLearn";
const DESCRIPTION =
  "مركز معرفة NiroLearn: أدلة عملية عن الدراسة بالذكاء الاصطناعي، تلخيص PDF، الفلاش كارد، التحضير للامتحان، الألعاب التعليمية، ومجموعات الأسئلة المحمية.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/learn" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    url: "/learn",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function LearnPage() {
  return <LearnIndex articles={INDEXABLE_LEARN_ARTICLES} />;
}
