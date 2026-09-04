"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, ClipboardList } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export default function QuizzesPage() {
  const mcqsQuery = trpc.books.listMcqs.useQuery();
  const submitAttempt = trpc.books.submitMcqAttempt.useMutation();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [attemptError, setAttemptError] = useState("");

  function answer(mcqId: string, index: number) {
    if (mcqId in answers) return; // one attempt per MCQ per visit
    setAttemptError("");
    setPendingId(mcqId);
    setAnswers(prev => ({ ...prev, [mcqId]: index }));
    submitAttempt.mutate(
      { mcqId, selectedIndex: index },
      {
        onSuccess: result => {
          setResults(prev => ({ ...prev, [mcqId]: result.isCorrect }));
          setPendingId(null);
        },
        onError: () => {
          setAnswers(prev => {
            const next = { ...prev };
            delete next[mcqId];
            return next;
          });
          setPendingId(null);
          setAttemptError("تعذر حفظ إجابتك. اختر الإجابة مرة أخرى.");
        },
      }
    );
  }

  const mcqs = mcqsQuery.data ?? [];

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> اختباراتي
          </div>
          <h1>
            اختبر <em>فهمك.</em>
          </h1>
          <p>أسئلة من كل الفصول اللي درستها في كل كتبك.</p>
        </div>
      </div>

      {attemptError && (
        <div className="inline-alert error wide">
          <CircleAlert size={16} />
          {attemptError}
        </div>
      )}

      {mcqsQuery.isError ? (
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر تحميل الاختبارات</h3>
          <p>تحقق من اتصالك وحاول مرة أخرى.</p>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 14 }}
            onClick={() => mcqsQuery.refetch()}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : mcqsQuery.isLoading ? (
        <div className="empty-state">
          <ClipboardList size={28} />
          <h3>جاري تحميل الأسئلة...</h3>
        </div>
      ) : !mcqs.length ? (
        <div className="empty-state">
          <ClipboardList size={28} />
          <h3>مافيش أسئلة لسه</h3>
          <p>هتظهر هنا تلقائيًا لما تحلّل فصول من كتبك.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mcqs.map(mcq => {
            const selected = answers[mcq.id];
            const isCorrect = results[mcq.id];
            const answered = mcq.id in answers;
            return (
              <div className="panel-card" key={mcq.id}>
                <span className="section-kicker">
                  {mcq.bookFileName} · {mcq.chapterTitle}
                </span>
                <strong
                  className="en"
                  style={{ display: "block", marginTop: 8 }}
                >
                  {mcq.questionEn}
                </strong>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {(mcq.choices as string[]).map((choice, i) => {
                    const isSelected = selected === i;
                    const isRightAnswer = answered && i === mcq.correctIndex;
                    return (
                      <button
                        type="button"
                        key={i}
                        className="en"
                        disabled={answered || pendingId === mcq.id}
                        onClick={() => answer(mcq.id, i)}
                        style={{
                          textAlign: "left",
                          padding: "9px 13px",
                          borderRadius: 9,
                          border: "1px solid",
                          borderColor: isRightAnswer
                            ? "#69a17f"
                            : isSelected
                              ? "#c8544d"
                              : "#e4ded5",
                          background: isRightAnswer
                            ? "#e3f0e8"
                            : isSelected
                              ? "#f9e3e0"
                              : "#fffdf9",
                          cursor: answered ? "default" : "pointer",
                          fontSize: 12,
                        }}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
                {answered && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: isCorrect ? "#528c6d" : "#974d49",
                    }}
                  >
                    {isCorrect ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <CircleAlert size={15} />
                    )}
                    {mcq.explanationEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
