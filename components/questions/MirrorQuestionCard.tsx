"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { CheckCircle2, KeyRound, Lightbulb, XCircle } from "lucide-react";
import { MarkableText, useMarkTool } from "@/components/CardMarks";
import {
  parseCardQuestion,
  resolveCardAnswer,
} from "@/lib/mirror-card-question";
import { optionState, type OptionState } from "./QuestionList";
import s from "./QuestionList.module.css";

export type MirrorCardData = {
  question: string;
  questionArabic: string;
  answer: string;
  answerArabic: string;
  explanation: string;
  explanationArabic: string;
  keyIdea: string;
  keyIdeaArabic: string;
  keyword: string;
  keywordArabic: string;
  confidence: string;
  imageUrl?: string | null;
};

const STATE_CLASS: Record<OptionState, string> = {
  idle: "",
  correct: s.correct,
  wrong: s.wrong,
  chosen: s.chosen,
  dimmed: s.dimmed,
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arabicNumber = (n: number) =>
  String(n).replace(/\d/g, d => ARABIC_DIGITS[Number(d)]);

// A مِرآة flashcard in the question-card design: the question's own
// options become tappable (green = right; a wrong pick turns red and the
// right one green), "اظهر الإجابة والشرح" still reveals everything without
// choosing, and the Arabic sits behind "عرض الترجمة". Everything the card
// had stays: the answer in both languages, both explanations, the key idea,
// the keyword, card marks (every text is still a MarkableText, split by
// ranges of the same stored field) and the image.
//
// A question this can't split into options (lib/mirror-card-question.ts)
// is shown whole, as before, and the reveal works exactly as it always did.
export default function MirrorQuestionCard({
  card,
  originTag,
  showAnswer,
  onReveal,
  onReset,
}: {
  card: MirrorCardData;
  originTag: string;
  showAnswer: boolean;
  onReveal: () => void;
  onReset: () => void;
}) {
  const tool = useMarkTool();
  const [selected, setSelected] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const parsed = useMemo(
    () => parseCardQuestion(card.question),
    [card.question]
  );
  const parsedAr = useMemo(
    () => parseCardQuestion(card.questionArabic ?? "", { arabic: true }),
    [card.questionArabic]
  );
  const optionTexts = parsed.options.map(r =>
    card.question.slice(r.start, r.end)
  );
  const correct = useMemo(
    () => resolveCardAnswer(card.answer, card.question, optionTexts),
    // optionTexts derives from card.question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.answer, card.question]
  );
  const interactive = parsed.options.length > 0;
  const answeredRight = selected !== null && selected === correct;

  function choose(index: number) {
    // While highlighting / drawing, a tap is marking, not answering.
    if (showAnswer || tool !== "none") return;
    setSelected(index);
    onReveal();
  }

  function onOptionKey(event: KeyboardEvent<HTMLDivElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
    }
  }

  return (
    <article className="flashcard">
      <div className="flashcard-topline">
        <span className="card-tag">QUESTION · {originTag}</span>
        <span className="card-confidence">{card.confidence} confidence</span>
      </div>

      <div className={s.card} style={{ border: 0, borderRadius: 0 }}>
        {card.imageUrl && (
          <img src={card.imageUrl} alt="" className={s.image} />
        )}

        <p className={s.question} dir="ltr">
          <MarkableText
            field="question"
            text={card.question}
            range={interactive ? parsed.stem : undefined}
          />
        </p>

        {interactive && (
          <ol className={s.options} dir="ltr">
            {parsed.options.map((range, i) => {
              const state = optionState(i, {
                selected,
                revealed: showAnswer,
                correct,
              });
              return (
                <li key={i}>
                  {/* A div, not a <button>: its text must stay selectable
                      for card marks. */}
                  <div
                    role="button"
                    tabIndex={showAnswer ? -1 : 0}
                    aria-disabled={showAnswer}
                    aria-pressed={selected === i}
                    data-state={state}
                    className={`${s.option} ${STATE_CLASS[state]}`}
                    onClick={() => choose(i)}
                    onKeyDown={event => onOptionKey(event, i)}
                  >
                    <span className={s.num}>{i + 1}.</span>
                    <span className={s.optionText}>
                      <MarkableText
                        field="question"
                        text={card.question}
                        range={range}
                      />
                    </span>
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
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {showAnswer ? (
          <div className={s.explain} role="status">
            {selected !== null && correct !== null && (
              <p
                className={`${s.result} ${answeredRight ? s.resultCorrect : s.resultWrong}`}
              >
                {answeredRight ? "إجابة صحيحة" : "إجابة خاطئة"}
              </p>
            )}
            <div className="answer-pair" style={{ margin: 0 }}>
              <strong dir="ltr">
                <MarkableText field="answer" text={card.answer} />
              </strong>
              <span dir="rtl">
                <MarkableText field="answerArabic" text={card.answerArabic} />
              </span>
            </div>
            <p dir="ltr">
              <MarkableText field="explanation" text={card.explanation} />
            </p>
            <p dir="rtl" className={s.explainAr}>
              <MarkableText
                field="explanationArabic"
                text={card.explanationArabic}
              />
            </p>
            {(card.keyIdea || card.keyIdeaArabic) && (
              <div>
                <span className={s.aiNote}>
                  <Lightbulb size={13} aria-hidden="true" /> الفكرة الأساسية
                </span>
                <p dir="ltr">
                  <strong>
                    <MarkableText field="keyIdea" text={card.keyIdea} />
                  </strong>
                </p>
                <p dir="rtl" className={s.explainAr}>
                  <MarkableText
                    field="keyIdeaArabic"
                    text={card.keyIdeaArabic}
                  />
                </p>
              </div>
            )}
            {(card.keyword || card.keywordArabic) && (
              <div className={s.keywords}>
                <span className={s.aiNote}>
                  <KeyRound size={13} aria-hidden="true" /> الكلمة المفتاحية
                </span>
                {card.keyword && (
                  <span className={s.keyword} dir="ltr">
                    <MarkableText field="keyword" text={card.keyword} />
                  </span>
                )}
                {card.keywordArabic && (
                  <span className={s.keyword} dir="rtl">
                    <MarkableText
                      field="keywordArabic"
                      text={card.keywordArabic}
                    />
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <button className="reveal-button" type="button" onClick={onReveal}>
            <span className="reveal-icon">?</span>
            <strong>اظهر الإجابة والشرح</strong>
            <small>Reveal answer &amp; explanation</small>
          </button>
        )}

        {showTranslation && card.questionArabic && (
          <div className={s.translation} dir="rtl" lang="ar">
            {parsedAr.options.length ? (
              <>
                <p className={s.translationQuestion}>
                  <MarkableText
                    field="questionArabic"
                    text={card.questionArabic}
                    range={parsedAr.stem}
                  />
                </p>
                <ol className={s.translationOptions}>
                  {parsedAr.options.map((range, i) => (
                    <li key={i}>
                      <span>{arabicNumber(i + 1)}.</span>
                      <span>
                        <MarkableText
                          field="questionArabic"
                          text={card.questionArabic}
                          range={range}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className={s.translationQuestion}>
                <MarkableText
                  field="questionArabic"
                  text={card.questionArabic}
                />
              </p>
            )}
          </div>
        )}

        <div className={s.footer}>
          <div className={s.footerStart}>
            {showAnswer && (
              <button
                type="button"
                className={s.textButton}
                onClick={() => {
                  setSelected(null);
                  onReset();
                }}
              >
                إعادة
              </button>
            )}
          </div>
          {card.questionArabic && (
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
      </div>
    </article>
  );
}
