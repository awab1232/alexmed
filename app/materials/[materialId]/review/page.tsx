"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// جلسة مراجعة بطاقات مادة أدمن — نفس تصميم بطاقة مِرآة (سؤال EN/AR، زر إظهار
// الإجابة، إجابة+شرح EN/AR، الفكرة الأساسية، رقم الصفحة، تقييم صعبة/جيدة/
// سهلة، رقم البطاقة/الإجمالي/نسبة الإنجاز) لكن مبنية على
// studentMaterialsRouter (بطاقات مشتركة + حالة SRS خاصة بكل طالب).
export default function StudentMaterialReviewPage() {
  const params = useParams<{ materialId: string }>();
  const materialId = params.materialId;
  const searchParams = useSearchParams();
  const dueOnly = searchParams.get("filter") === "due";

  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const cardsQuery = trpc.materials.cards.useQuery({ materialId });
  const rateCard = trpc.materials.rateCard.useMutation();
  const utils = trpc.useUtils();

  const queue = useMemo(() => {
    const all = cardsQuery.data ?? [];
    if (!dueOnly) return all;
    const now = Date.now();
    return all.filter(
      card => !card.review || new Date(card.review.dueAt).getTime() <= now
    );
  }, [cardsQuery.data, dueOnly]);

  const current = queue[index];

  function next() {
    setShowAnswer(false);
    setIndex(current => current + 1);
  }

  function rate(rating: "hard" | "good" | "easy") {
    if (!current) return;
    rateCard.mutate(
      { materialCardId: current.id, rating },
      {
        onSuccess: () => {
          utils.materials.get.invalidate({ materialId });
          next();
        },
      }
    );
  }

  if (cardsQuery.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل البطاقات...</h3>
        </div>
      </section>
    );
  }

  if (cardsQuery.isError) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر تحميل هذه المادة</h3>
          <Link
            href="/materials"
            className="secondary-button"
            style={{ marginTop: 12 }}
          >
            العودة للمكتبة
          </Link>
        </div>
      </section>
    );
  }

  if (!queue.length || !current) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CheckCircle2 size={28} />
          <h3>
            {dueOnly ? "لا توجد بطاقات مستحقة اليوم" : "لا توجد بطاقات بعد"}
          </h3>
          <Link
            href={`/materials/${materialId}`}
            className="secondary-button"
            style={{ marginTop: 12 }}
          >
            العودة للمادة
          </Link>
        </div>
      </section>
    );
  }

  const completionPercent = Math.round((index / queue.length) * 100);

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link
            href={`/materials/${materialId}`}
            className="eyebrow"
            style={{ marginBottom: 8 }}
          >
            <span className="eyebrow-dot" /> ‹ رجوع للمادة
          </Link>
          <h1>جلسة المراجعة</h1>
          <p>
            بطاقة {index + 1} من {queue.length} · {completionPercent}% إنجاز
          </p>
        </div>
      </div>

      <div className="progress-track" aria-label="تقدم الجلسة">
        <i style={{ width: `${completionPercent}%` }} />
      </div>

      <div style={{ marginTop: 18, maxWidth: 640 }}>
        <div className="flashcard-wrap">
          <div className="flashcard-meta">
            <span>
              بطاقة {String(index + 1).padStart(2, "0")} من{" "}
              {String(queue.length).padStart(2, "0")}
            </span>
          </div>
          <article className="flashcard">
            <div className="flashcard-topline">
              <span className="card-tag">
                QUESTION · PAGE {current.sourcePage}
              </span>
              <span className="card-confidence">
                {current.confidence} confidence
              </span>
            </div>
            <div className="question-block">
              <span className="micro-label">السؤال / QUESTION</span>
              <h2>{current.questionAr}</h2>
              <p>{current.questionEn}</p>
            </div>
            <div
              className={showAnswer ? "answer-block revealed" : "answer-block"}
            >
              {showAnswer ? (
                <>
                  <span className="micro-label">
                    الإجابة والشرح / ANSWER & WHY
                  </span>
                  <div className="answer-pair">
                    <strong>{current.answerAr}</strong>
                    <span>{current.answerEn}</span>
                  </div>
                  <div className="explanation-pair">
                    <p>{current.explanationAr}</p>
                    <p>{current.explanationEn}</p>
                  </div>
                  {(current.keyIdeaAr || current.keyIdeaEn) && (
                    <div className="concept-grid">
                      <div>
                        <span>الفكرة الأساسية</span>
                        <strong>{current.keyIdeaAr}</strong>
                        <small>{current.keyIdeaEn}</small>
                      </div>
                      {(current.keywordAr || current.keywordEn) && (
                        <div>
                          <span>الكلمة المفتاحية</span>
                          <strong>{current.keywordAr}</strong>
                          <small>{current.keywordEn}</small>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={rateCard.isPending}
                      onClick={() => rate("hard")}
                    >
                      صعبة
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={rateCard.isPending}
                      onClick={() => rate("good")}
                    >
                      جيدة
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={rateCard.isPending}
                      onClick={() => rate("easy")}
                    >
                      سهلة
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="reveal-button"
                  onClick={() => setShowAnswer(true)}
                >
                  <span className="reveal-icon">?</span>
                  <strong>اظهر الإجابة والشرح</strong>
                  <small>Reveal answer & explanation</small>
                </button>
              )}
            </div>
          </article>

          <div className="card-navigation">
            <button
              type="button"
              onClick={() => {
                setShowAnswer(false);
                setIndex(current => Math.max(0, current - 1));
              }}
              disabled={index === 0}
            >
              <ChevronRight size={17} /> السابقة
            </button>
            <button
              type="button"
              className="next"
              onClick={next}
              disabled={index >= queue.length - 1}
            >
              التالية <ChevronLeft size={17} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
