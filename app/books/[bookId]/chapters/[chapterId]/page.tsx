"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

type Tab = "explanation" | "terms" | "cards" | "mcqs";

const TABS: { id: Tab; label: string }[] = [
  { id: "explanation", label: "الشرح" },
  { id: "terms", label: "المصطلحات الطبية" },
  { id: "cards", label: "البطاقات" },
  { id: "mcqs", label: "الاختبار" },
];

export default function ChapterDetailPage() {
  const params = useParams<{ bookId: string; chapterId: string }>();
  const query = trpc.books.getChapter.useQuery({ id: params.chapterId });
  const [tab, setTab] = useState<Tab>("explanation");

  if (query.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل الفصل...</h3>
        </div>
      </section>
    );
  }

  if (!query.data) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر العثور على هذا الفصل</h3>
        </div>
      </section>
    );
  }

  const { chapter, terms, cards, mcqs } = query.data;

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link
            href={`/books/${params.bookId}`}
            className="eyebrow"
            style={{ marginBottom: 8 }}
          >
            <span className="eyebrow-dot" /> ‹ رجوع للكتاب
          </Link>
          <h1>{chapter.title}</h1>
          <p>
            صفحة {chapter.startPage}–{chapter.endPage}
          </p>
        </div>
      </div>

      <div className="cards-toolbar" style={{ gap: 8, marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? "filter-button active" : "filter-button"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "explanation" && (
        <div
          className="panel-card"
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          {chapter.chapterSummary && (
            <div>
              <span className="micro-label">ملخص الفصل</span>
              <p>{chapter.chapterSummary}</p>
            </div>
          )}
          <div>
            <span className="micro-label">الشرح بالعربي</span>
            <p style={{ whiteSpace: "pre-line" }}>{chapter.explanationAr}</p>
          </div>
          <div>
            <span className="micro-label">English Explanation</span>
            <p
              className="en"
              style={{ whiteSpace: "pre-line", direction: "ltr" }}
            >
              {chapter.explanationEn}
            </p>
          </div>
          {!!chapter.keyPoints?.length && (
            <div>
              <span className="micro-label">أهم النقاط</span>
              <ul>
                {chapter.keyPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "terms" && (
        <div className="library-grid">
          {terms.map(term => (
            <div className="library-item" key={term.id}>
              <div className="library-item-meta">
                <strong>{term.ar}</strong>
                <span>
                  {term.en} · {term.pronunciation}
                </span>
              </div>
            </div>
          ))}
          {!terms.length && <p>لا توجد مصطلحات لهذا الفصل.</p>}
        </div>
      )}

      {tab === "cards" && (
        <div className="review-layout">
          <div className="card-list">
            {cards.map(card => (
              <div className="list-card" key={card.id}>
                <span className="list-copy">
                  <strong>{card.questionAr}</strong>
                  <small>
                    صفحة {card.sourcePage} · {card.answerAr}
                  </small>
                </span>
              </div>
            ))}
            {!cards.length && <p>لا توجد بطاقات لهذا الفصل.</p>}
          </div>
        </div>
      )}

      {tab === "mcqs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mcqs.map(mcq => (
            <div className="panel-card" key={mcq.id}>
              <strong className="en">{mcq.questionEn}</strong>
              <ul style={{ marginTop: 10 }}>
                {(mcq.choices as string[]).map((choice, i) => (
                  <li
                    key={i}
                    className="en"
                    style={{
                      fontWeight: i === mcq.correctIndex ? 700 : 400,
                      color: i === mcq.correctIndex ? "#5d9b78" : undefined,
                    }}
                  >
                    {choice}
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 8, fontSize: 12, color: "#8a9493" }}>
                {mcq.explanationEn}
              </p>
            </div>
          ))}
          {!mcqs.length && <p>لا توجد أسئلة لهذا الفصل.</p>}
        </div>
      )}
    </section>
  );
}
