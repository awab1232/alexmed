"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import s from "./QuestionList.module.css";

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
  // The Arabic version (from the file itself, or machine-translated once
  // in the pipeline — translationSource says which).
  questionTextAr?: string | null;
  optionsAr?: string[] | null;
  translationSource?: string | null;
};

// The answer a card checks against: the file's own stated answer, else the
// pipeline's AI suggestion (labelled as such), else none.
export function correctAnswerOf(question: QuestionListItem): {
  index: number | null;
  fromAi: boolean;
} {
  if (question.extractedAnswerIndex !== null) {
    return { index: question.extractedAnswerIndex, fromAi: false };
  }
  if (question.aiInferredAnswerIndex !== null) {
    return { index: question.aiInferredAnswerIndex, fromAi: true };
  }
  return { index: null, fromAi: false };
}

export type OptionState = "idle" | "correct" | "wrong" | "chosen" | "dimmed";

// Pure (unit-tested): how option `i` looks once the card is answered or
// revealed. Before that every option is idle and tappable.
export function optionState(
  i: number,
  card: { selected: number | null; revealed: boolean; correct: number | null }
): OptionState {
  if (!card.revealed) return "idle";
  if (card.correct === null) return card.selected === i ? "chosen" : "idle";
  if (i === card.correct) return "correct";
  if (i === card.selected) return "wrong";
  return "dimmed";
}

const STATE_CLASS: Record<OptionState, string> = {
  idle: "",
  correct: s.correct,
  wrong: s.wrong,
  chosen: s.chosen,
  dimmed: s.dimmed,
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function arabicNumber(n: number): string {
  return String(n).replace(/\d/g, d => ARABIC_DIGITS[Number(d)]);
}

// The question-file cards, shared by a student's own question file, a
// doctor's protected set (student view and the doctor's preview).
// Tap an option to answer: correct turns green; a wrong pick turns red and
// the correct option turns green. "أظهر الإجابة" reveals without choosing.
// The Arabic version sits behind "عرض الترجمة".
//
// `watermark` (a protected set's student view only) tiles a faint diagonal
// line of text over each card, image included. It makes a screenshot
// traceable to the account it came from; it cannot stop one being taken.
// `revealAll` (the doctor's review) shows every answer at once.
export default function QuestionList({
  questions,
  watermark,
  revealAll = false,
}: {
  questions: QuestionListItem[];
  watermark?: string;
  revealAll?: boolean;
}) {
  const watermarkImage = watermark ? watermarkTile(watermark) : null;
  return (
    <div className={s.list}>
      {questions.map((question, i) => (
        <QuestionCard
          key={question.id}
          question={question}
          position={i + 1}
          total={questions.length}
          watermarkImage={watermarkImage}
          revealAll={revealAll}
        />
      ))}
    </div>
  );
}

function QuestionCard({
  question,
  position,
  total,
  watermarkImage,
  revealAll,
}: {
  question: QuestionListItem;
  position: number;
  total: number;
  watermarkImage: string | null;
  revealAll: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealedByUser, setRevealed] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const revealed = revealAll || revealedByUser;
  const { index: correct, fromAi } = correctAnswerOf(question);
  const options = question.options ?? [];
  const hasTranslation = !!question.questionTextAr;
  const answeredRight = selected !== null && selected === correct;

  return (
    <article className={s.card} aria-label={`سؤال ${position} من ${total}`}>
      {watermarkImage && (
        <div
          aria-hidden="true"
          data-testid="question-watermark"
          className={s.watermark}
          style={{ backgroundImage: watermarkImage }}
        />
      )}

      <div className={s.head}>
        <span className={s.label} dir="ltr">
          {/* Arabic is never letter-spaced (it breaks the joining). */}
          <span className={s.labelEn}>QUESTION</span> / السؤال
        </span>
        <span className={s.counter} dir="ltr">
          {position} / {total}
        </span>
      </div>

      {question.imageUrl && (
        // Same URL for every question sharing this page's image — never
        // re-fetched or duplicated in storage.
        <img src={question.imageUrl} alt="" className={s.image} />
      )}

      <p className={s.question} dir="auto">
        {question.questionText}
      </p>

      {options.length > 0 && (
        <ol className={s.options} dir="auto">
          {options.map((option, i) => {
            const state = optionState(i, { selected, revealed, correct });
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`${s.option} ${STATE_CLASS[state]}`}
                  disabled={revealed}
                  aria-pressed={selected === i}
                  data-state={state}
                  onClick={() => {
                    setSelected(i);
                    setRevealed(true);
                  }}
                >
                  <span className={s.num}>{i + 1}.</span>
                  <span className={s.optionText}>{option}</span>
                  {state === "correct" && (
                    <CheckCircle2
                      size={18}
                      className={s.mark}
                      color="var(--nl-correct)"
                      aria-hidden="true"
                    />
                  )}
                  {state === "wrong" && (
                    <XCircle
                      size={18}
                      className={s.mark}
                      color="var(--nl-wrong)"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {revealed && (
        <div role="status" className={s.explain}>
          {selected !== null && correct !== null && (
            <p
              className={`${s.result} ${answeredRight ? s.resultCorrect : s.resultWrong}`}
            >
              {answeredRight ? "إجابة صحيحة" : "إجابة خاطئة"}
            </p>
          )}
          {correct === null ? (
            <p className={`${s.result} ${s.resultNeutral}`}>
              {options.length
                ? "لا توجد إجابة مذكورة لهذا السؤال في الملف."
                : question.explanationText ||
                  "لا توجد إجابة مذكورة لهذا السؤال."}
            </p>
          ) : fromAi ? (
            <p className={s.aiNote}>
              <Sparkles size={12} aria-hidden="true" /> إجابة مقترحة من الذكاء
              الاصطناعي — لم تُذكر إجابة في الملف الأصلي.
            </p>
          ) : null}
          {question.explanationText && options.length > 0 && (
            <p dir="auto">{question.explanationText}</p>
          )}
          {question.aiExplanationAr && (
            <p className={s.explainAr} dir="rtl">
              {question.aiExplanationAr}
            </p>
          )}
          {!!question.keywords?.length && (
            <div className={s.keywords}>
              {question.keywords.map(keyword => (
                <span key={keyword} className={s.keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showTranslation && hasTranslation && (
        <div className={s.translation} dir="rtl" lang="ar">
          {question.translationSource === "machine" && (
            <span className={s.machineTag}>ترجمة آلية</span>
          )}
          <p className={s.translationQuestion}>{question.questionTextAr}</p>
          {!!question.optionsAr?.length && (
            <ol className={s.translationOptions}>
              {question.optionsAr.map((option, i) => (
                <li key={i}>
                  <span>{arabicNumber(i + 1)}.</span>
                  <span>{option}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {(!revealAll || hasTranslation) && (
        <div className={s.footer}>
          <div className={s.footerStart}>
            {!revealed && (
              <button
                type="button"
                className={s.textButton}
                onClick={() => setRevealed(true)}
              >
                أظهر الإجابة
              </button>
            )}
            {revealedByUser && !revealAll && (
              <button
                type="button"
                className={s.textButton}
                onClick={() => {
                  setSelected(null);
                  setRevealed(false);
                }}
              >
                إعادة
              </button>
            )}
          </div>
          {hasTranslation && (
            <button
              type="button"
              className={s.pill}
              aria-expanded={showTranslation}
              onClick={() => setShowTranslation(value => !value)}
            >
              {showTranslation ? "إخفاء الترجمة" : "عرض الترجمة"}
            </button>
          )}
        </div>
      )}
    </article>
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
