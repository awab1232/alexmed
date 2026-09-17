"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const POLL_INTERVAL_MS = 3000;

// PR16 — shows exactly what was really found in the file: the extracted
// answer (if the source stated one) is visually distinct from "no answer in
// source" — never filled in with a guess.
//
// Multimodal upgrade — every question is now automatically run through
// vision-aware AI (lib/question-file-analysis.ts) right after upload, image
// or not: keywords/aiExplanationAr always end up populated, imageUrl only
// when this question's page range actually had one (never an empty
// container), and aiInferredAnswerIndex only when the source itself gave no
// answer — always rendered with its own distinct "AI-suggested" label, never
// blended visually with a real extractedAnswerIndex.
export default function QuestionFileDetailPage() {
  const params = useParams<{ bookId: string }>();
  const utils = trpc.useUtils();
  const fileQuery = trpc.questionFiles.get.useQuery(
    { bookId: params.bookId },
    {
      refetchInterval: query =>
        query.state.data?.book.status === "extracting" ||
        (query.state.data?.book.status === "complete" &&
          query.state.data?.coverage.done === false)
          ? POLL_INTERVAL_MS
          : false,
    }
  );
  const retryExtraction = trpc.questionFiles.retryExtraction.useMutation({
    onSuccess: () =>
      utils.questionFiles.get.invalidate({ bookId: params.bookId }),
  });

  if (fileQuery.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري التحميل...</h3>
        </div>
      </section>
    );
  }

  if (!fileQuery.data) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر العثور على هذا الملف</h3>
          <Link
            href="/books/question-files"
            className="secondary-button"
            style={{ marginTop: 12 }}
          >
            العودة لملفات الأسئلة
          </Link>
        </div>
      </section>
    );
  }

  const { book, questions } = fileQuery.data;

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link
            href="/books/question-files"
            className="eyebrow"
            style={{ marginBottom: 8 }}
          >
            <span className="eyebrow-dot" /> ‹ ملفات الأسئلة
          </Link>
          <h1>{book.fileName}</h1>
          <p>{questions.length} سؤال مستخرج</p>
        </div>
      </div>

      {book.status === "extracting" && (
        <div className="inline-alert warning wide">
          <Loader2 size={16} className="spin" />
          جاري استخراج الأسئلة من الملف — تقدر تسكّر الصفحة وترجع بعدين.
        </div>
      )}

      {book.status === "failed" && (
        <div className="inline-alert error wide">
          <CircleAlert size={16} />
          <span>
            {book.extractionError || "تعذر استخراج الأسئلة من هذا الملف."}
          </span>
          <button
            type="button"
            className="secondary-button"
            style={{ marginRight: 12 }}
            disabled={retryExtraction.isPending}
            onClick={() => retryExtraction.mutate({ bookId: book.id })}
          >
            <RotateCcw size={14} /> إعادة المعالجة
          </button>
        </div>
      )}

      {book.status === "complete" && !questions.length && (
        <div className="empty-state">
          <ClipboardList size={28} />
          <h3>لم يتم العثور على أسئلة</h3>
        </div>
      )}

      {!!questions.length && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {questions.map((question, i) => {
            const hasStatedAnswer = question.extractedAnswerIndex !== null;
            const hasInferredAnswer =
              !hasStatedAnswer && question.aiInferredAnswerIndex !== null;
            return (
              <div className="panel-card" key={question.id}>
                <span className="section-kicker">
                  سؤال {i + 1} · صفحة {question.sourcePage}
                </span>
                {question.imageUrl && (
                  // Same URL rendered verbatim for every question sharing
                  // this page's image — never re-fetched or duplicated in
                  // storage, see lib/db-question-files.ts's imagesByQuestionId
                  // map.
                  <img
                    src={question.imageUrl}
                    alt=""
                    style={{
                      display: "block",
                      width: "100%",
                      maxWidth: 420,
                      borderRadius: 10,
                      marginTop: 8,
                      border: "1px solid #e4ded5",
                    }}
                  />
                )}
                <strong style={{ display: "block", marginTop: 8 }}>
                  {question.questionText}
                </strong>
                {!!question.options?.length && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginTop: 10,
                    }}
                  >
                    {question.options.map((option, optionIndex) => {
                      const isExtractedAnswer =
                        question.extractedAnswerIndex === optionIndex;
                      const isInferredAnswer =
                        hasInferredAnswer &&
                        question.aiInferredAnswerIndex === optionIndex;
                      return (
                        <div
                          key={optionIndex}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: isInferredAnswer
                              ? "1px dashed #b8934a"
                              : "1px solid",
                            borderColor: isExtractedAnswer
                              ? "#69a17f"
                              : isInferredAnswer
                                ? "#b8934a"
                                : "#e4ded5",
                            background: isExtractedAnswer
                              ? "#e3f0e8"
                              : isInferredAnswer
                                ? "#f6ecd9"
                                : "#fffdf9",
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {isExtractedAnswer && (
                            <CheckCircle2 size={14} color="#528c6d" />
                          )}
                          {isInferredAnswer && (
                            <Sparkles size={14} color="#b8934a" />
                          )}
                          {option}
                        </div>
                      );
                    })}
                  </div>
                )}
                {hasInferredAnswer ? (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#8a6a2f",
                      marginTop: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Sparkles size={12} />
                    إجابة مقترحة من الذكاء الاصطناعي — لم تُذكر إجابة في الملف
                    الأصلي.
                  </p>
                ) : (
                  !hasStatedAnswer && (
                    <p style={{ fontSize: 12, color: "#974d49", marginTop: 8 }}>
                      لم تُذكر إجابة صحيحة لهذا السؤال في الملف الأصلي.
                    </p>
                  )
                )}
                {question.explanationText && (
                  <p style={{ fontSize: 12, color: "#8a9493", marginTop: 8 }}>
                    {question.explanationText}
                  </p>
                )}
                {question.aiExplanationAr && (
                  <p style={{ fontSize: 12, color: "#5c6b78", marginTop: 8 }}>
                    {question.aiExplanationAr}
                  </p>
                )}
                {!!question.keywords?.length && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 10,
                    }}
                  >
                    {question.keywords.map(keyword => (
                      <span
                        key={keyword}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#eef1ef",
                          color: "#5c6b78",
                        }}
                      >
                        {keyword}
                      </span>
                    ))}
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
