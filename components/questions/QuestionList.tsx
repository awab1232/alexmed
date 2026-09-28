"use client";

import { CheckCircle2, Sparkles } from "lucide-react";

// One question-file question as the cards render it — the safe projection
// lib/db-question-files.ts's readQuestionFileContent returns.
export type QuestionListItem = {
  id: string;
  questionText: string;
  options: string[] | null;
  extractedAnswerIndex: number | null;
  aiInferredAnswerIndex: number | null;
  explanationText: string | null;
  sourcePage: number;
  keywords: string[] | null;
  aiExplanationAr: string | null;
  imageUrl: string | null;
};

// The question-file cards (PR16 + multimodal upgrade), shared by the
// owner's own question file and any other read of the same questions.
// Shows exactly what was really found in the file: a source-stated answer
// is visually distinct from an AI-suggested one, and "no answer in source"
// is never filled in with a guess.
//
// `watermark` (a protected set's student view only) tiles a faint diagonal
// line of text over each card, image included. It makes a screenshot
// traceable to the account it came from; it cannot stop one being taken.
export default function QuestionList({
  questions,
  watermark,
}: {
  questions: QuestionListItem[];
  watermark?: string;
}) {
  const watermarkImage = watermark ? watermarkTile(watermark) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {questions.map((question, i) => {
        const hasStatedAnswer = question.extractedAnswerIndex !== null;
        const hasInferredAnswer =
          !hasStatedAnswer && question.aiInferredAnswerIndex !== null;
        return (
          <div
            className="panel-card"
            key={question.id}
            style={
              watermarkImage
                ? { position: "relative", overflow: "hidden" }
                : undefined
            }
          >
            {watermarkImage && (
              <div
                aria-hidden="true"
                data-testid="question-watermark"
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 1,
                  pointerEvents: "none",
                  userSelect: "none",
                  backgroundImage: watermarkImage,
                  backgroundRepeat: "repeat",
                }}
              />
            )}
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
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// One tile of the repeated watermark as a CSS background: the text at a
// diagonal, in ink at ~9% opacity, so it stays readable-through on both the
// question text and the page image.
export function watermarkTile(text: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150">` +
    `<text x="130" y="80" text-anchor="middle" transform="rotate(-24 130 75)" ` +
    `font-family="sans-serif" font-size="13" fill="#1b2340" fill-opacity="0.09">` +
    `${escapeXml(text)}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
