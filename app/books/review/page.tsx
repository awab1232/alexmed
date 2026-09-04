"use client";

import { useState } from "react";
import { CheckCircle2, Layers3 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export default function ReviewPage() {
  const dueQuery = trpc.books.dueCards.useQuery();
  const utils = trpc.useUtils();
  const rateCard = trpc.books.rateCard.useMutation({
    onSuccess: () => utils.books.dueCards.invalidate(),
  });
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const cards = dueQuery.data ?? [];
  const card = cards[index];

  function rate(rating: "hard" | "good" | "easy") {
    if (!card) return;
    rateCard.mutate({ cardId: card.id, rating });
    setShowAnswer(false);
    setIndex(current => Math.min(current, Math.max(0, cards.length - 2)));
  }

  if (dueQuery.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Layers3 size={28} />
          <h3>جاري تحميل بطاقاتك...</h3>
        </div>
      </section>
    );
  }

  if (dueQuery.isError) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Layers3 size={28} />
          <h3>تعذر تحميل المراجعة</h3>
          <p>تحقق من اتصالك وحاول مرة أخرى.</p>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 14 }}
            onClick={() => dueQuery.refetch()}
          >
            إعادة المحاولة
          </button>
        </div>
      </section>
    );
  }

  if (!cards.length) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CheckCircle2 size={28} />
          <h3>ممتاز، مافيش بطاقات مستحقة اليوم</h3>
          <p>ارجع بعدين، أو ارفع كتاب جديد.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot green" /> المراجعة اليومية
          </div>
          <h1>
            بطاقة {index + 1} من {cards.length}
          </h1>
          <p>باقي لك {cards.length - index} بطاقة فقط.</p>
        </div>
      </div>

      <article className="flashcard">
        <div className="flashcard-topline">
          <span className="card-tag">
            {card.bookFileName} · {card.chapterTitle} · صفحة {card.sourcePage}
          </span>
        </div>
        <div className="question-block">
          <span className="micro-label">السؤال / QUESTION</span>
          <h2>{card.questionAr}</h2>
          <p>{card.questionEn}</p>
        </div>
        <div className={showAnswer ? "answer-block revealed" : "answer-block"}>
          {showAnswer ? (
            <>
              <span className="micro-label">الإجابة / ANSWER</span>
              <div className="answer-pair">
                <strong>{card.answerAr}</strong>
                <span>{card.answerEn}</span>
              </div>
              {card.relatedTermEn && (
                <div className="concept-grid">
                  <div>
                    <span>المصطلح المرتبط</span>
                    <strong className="en">{card.relatedTermEn}</strong>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className="reveal-button"
              onClick={() => setShowAnswer(true)}
            >
              <span className="reveal-icon">?</span>
              <strong>اظهر الإجابة</strong>
              <small>Show Answer</small>
            </button>
          )}
        </div>
      </article>

      {showAnswer && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            className="secondary-button"
            style={{ background: "#faeddc", color: "#936239", border: "none" }}
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
            style={{ background: "#e3f0e8", color: "#528c6d", border: "none" }}
            disabled={rateCard.isPending}
            onClick={() => rate("easy")}
          >
            سهلة
          </button>
        </div>
      )}
    </section>
  );
}
