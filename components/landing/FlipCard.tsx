"use client";

// A real flashcard to try on the page: question on the front, answer on the
// back. Motion answers the click (3D flip; an instant swap under reduced
// motion). The hidden face is aria-hidden so screen readers hear one side.
import { useState } from "react";
import t from "./transform.module.css";

export default function FlipCard({
  question,
  answer,
}: {
  question: string;
  answer: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div>
      <button
        type="button"
        className={t.flip}
        aria-pressed={flipped}
        onClick={() => setFlipped(value => !value)}
      >
        <span className={t.flipInner}>
          <span className={t.flipFace} aria-hidden={flipped}>
            <span className={t.flipLabel}>سؤال</span>
            <span className={t.flipText}>{question}</span>
          </span>
          <span
            className={`${t.flipFace} ${t.flipBack}`}
            aria-hidden={!flipped}
          >
            <span className={t.flipLabel}>الإجابة</span>
            <span className={t.flipText}>{answer}</span>
          </span>
        </span>
      </button>
      <p className={t.flipHint} aria-live="polite">
        {flipped
          ? "كيف كانت؟ في التطبيق تقيّمها لتعود إليك في موعدها."
          : "حاول تتذكّر الإجابة، ثم اضغط على البطاقة لتقلبها."}
      </p>
    </div>
  );
}
