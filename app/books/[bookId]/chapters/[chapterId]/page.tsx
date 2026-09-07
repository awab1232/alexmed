"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import BookPageViewer from "@/components/BookPageViewer";

type Tab = "pages" | "explanation" | "terms" | "cards" | "mcqs";

// "الصفحات الأصلية" أول تبويب وافتراضي — التبويبات الأربع الأخرى (نظرة
// إجمالية نصّية للفصل كله) تبقى كما هي بدون أي حذف.
const TABS: { id: Tab; label: string }[] = [
  { id: "pages", label: "الصفحات الأصلية" },
  { id: "explanation", label: "الشرح" },
  { id: "terms", label: "المصطلحات الطبية" },
  { id: "cards", label: "البطاقات" },
  { id: "mcqs", label: "الاختبار" },
];

export default function ChapterDetailPage() {
  const params = useParams<{ bookId: string; chapterId: string }>();
  const query = trpc.books.getChapter.useQuery({ id: params.chapterId });
  const [tab, setTab] = useState<Tab>("pages");
  const [pageIndex, setPageIndex] = useState(0);

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

  const { chapter, terms, cards, mcqs, pages } = query.data;
  const currentPage = pages[pageIndex];
  const pageCardsAndMcqs = currentPage
    ? {
        cards: cards.filter(card => card.sourcePage === currentPage.pageNumber),
        mcqs: mcqs.filter(mcq => mcq.sourcePage === currentPage.pageNumber),
      }
    : { cards: [], mcqs: [] };
  const pagesProgressPercent = pages.length
    ? Math.round(((pageIndex + 1) / pages.length) * 100)
    : 0;

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
            type="button"
            key={t.id}
            className={tab === t.id ? "filter-button active" : "filter-button"}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pages" &&
        (!pages.length ? (
          <div className="empty-state">
            <Loader2 size={28} className="spin" />
            <h3>صفحات هذا الفصل قيد التجهيز البصري...</h3>
            <p>النصوص والبطاقات جاهزة بالتبويبات الأخرى بالفعل.</p>
          </div>
        ) : (
          <div>
            <div className="progress-track" aria-label="تقدم صفحات الفصل">
              <i style={{ width: `${pagesProgressPercent}%` }} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                margin: "10px 0 16px",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex(i => Math.max(0, i - 1))}
              >
                <ChevronRight size={16} /> السابقة
              </button>
              <span style={{ fontSize: 12, color: "#8d9895" }}>
                صفحة {pageIndex + 1} من {pages.length}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={pageIndex >= pages.length - 1}
                onClick={() =>
                  setPageIndex(i => Math.min(pages.length - 1, i + 1))
                }
              >
                التالية <ChevronLeft size={16} />
              </button>
            </div>

            {currentPage && (
              <BookPageViewer
                page={currentPage}
                visuals={currentPage.visuals}
                showExtractedText
                showSummary
                showCards
                showMcqs
                summaryNode={
                  <div
                    className="panel-card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 18,
                      margin: "0 14px 14px",
                    }}
                  >
                    <div>
                      <span className="micro-label">الشرح بالعربي</span>
                      <p style={{ whiteSpace: "pre-line" }}>
                        {chapter.explanationAr}
                      </p>
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
                    {!!terms.length && (
                      <div>
                        <span className="micro-label">المصطلحات الطبية</span>
                        <ul>
                          {terms.map(term => (
                            <li key={term.id}>
                              {term.ar} — {term.en} ({term.pronunciation})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                }
                cardsNode={
                  <div style={{ margin: "0 14px 14px" }}>
                    <span className="micro-label">
                      البطاقات المرتبطة بهذه الصفحة
                    </span>
                    {!pageCardsAndMcqs.cards.length ? (
                      <p style={{ fontSize: 12, color: "#8d9895" }}>
                        لا توجد بطاقات لهذه الصفحة تحديدًا.
                      </p>
                    ) : (
                      <div className="library-grid" style={{ marginTop: 8 }}>
                        {pageCardsAndMcqs.cards.map(card => (
                          <div className="library-item" key={card.id}>
                            <div className="library-item-meta">
                              <strong>{card.questionAr}</strong>
                              <span>{card.answerAr}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                }
                mcqsNode={
                  !pageCardsAndMcqs.mcqs.length ? null : (
                    <div style={{ margin: "0 14px 14px" }}>
                      <span className="micro-label">
                        أسئلة MCQ المرتبطة بهذه الصفحة
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          marginTop: 8,
                        }}
                      >
                        {pageCardsAndMcqs.mcqs.map(mcq => (
                          <div className="panel-card" key={mcq.id}>
                            <strong className="en">{mcq.questionEn}</strong>
                            <ul style={{ marginTop: 10 }}>
                              {(mcq.choices as string[]).map((choice, i) => (
                                <li
                                  key={i}
                                  className="en"
                                  style={{
                                    fontWeight:
                                      i === mcq.correctIndex ? 700 : 400,
                                    color:
                                      i === mcq.correctIndex
                                        ? "#5d9b78"
                                        : undefined,
                                  }}
                                >
                                  {choice}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
              />
            )}
          </div>
        ))}

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
