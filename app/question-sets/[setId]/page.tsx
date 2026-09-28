"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import QuestionList from "@/components/questions/QuestionList";

// A protected set, opened: the SAME question cards as any question file
// (components/questions/QuestionList.tsx), over the same stored questions —
// no PDF, no second renderer. Access is re-checked on every load; images
// come from an access-checked, no-store route.
export default function ProtectedQuestionSetPage() {
  const { setId } = useParams<{ setId: string }>();
  const query = trpc.questionSets.get.useQuery(
    { setId },
    { retry: false, refetchOnWindowFocus: true }
  );

  if (query.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري التحميل...</h3>
        </div>
      </section>
    );
  }

  if (!query.data) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>هذه المجموعة غير متاحة حاليًا</h3>
          <Link
            href="/question-sets"
            className="secondary-button"
            style={{ marginTop: 12 }}
          >
            مجموعات الدكاترة
          </Link>
        </div>
      </section>
    );
  }

  const { set, questions, watermark } = query.data;

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link
            href="/question-sets"
            className="eyebrow"
            style={{ marginBottom: 8 }}
          >
            <span className="eyebrow-dot" /> ‹ مجموعات الدكاترة
          </Link>
          <h1>{set?.title}</h1>
          <p>
            {[set?.doctorName, set?.subjectLabel, `${questions.length} سؤال`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <QuestionList questions={questions} watermark={watermark ?? undefined} />
    </section>
  );
}
