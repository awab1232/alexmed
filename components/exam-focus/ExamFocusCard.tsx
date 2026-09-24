"use client";

import Link from "next/link";
import { Bookmark, BookOpen } from "lucide-react";
import { categoryInfo, splitHighlights } from "@/lib/exam-focus-categories";

export type ExamFocusCardData = {
  id: string;
  category: string;
  topic: string;
  title: string;
  points: string[];
  highlightLabel: string;
  highlightText: string;
  flag: string;
  sourcePages: number[];
  bookmarked: boolean;
};

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {splitHighlights(text).map((segment, i) =>
        segment.highlight ? (
          <mark key={i} className="ef-num">
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

// Lines the model wrote with its own bullet keep one bullet (ours).
const stripBullet = (line: string) => line.replace(/^\s*[•\-*–]\s+/, "");

export function pagesLabel(pages: number[]) {
  if (!pages.length) return "";
  if (pages.length === 1) return `p. ${pages[0]}`;
  const sorted = [...pages].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (page, i) => i === 0 || page === sorted[i - 1] + 1
  );
  return contiguous
    ? `pp. ${sorted[0]}–${sorted[sorted.length - 1]}`
    : `pp. ${sorted.slice(0, 4).join(", ")}${sorted.length > 4 ? "…" : ""}`;
}

// One high-yield knowledge card (English source content, LTR): category
// badge, topic, title, short lines with numbers highlighted, the single
// most important takeaway, an ambiguity note when the source was unclear,
// and a link back to the source page in the PDF reader.
export default function ExamFocusCard({
  card,
  bookId,
  position,
  total,
  onToggleBookmark,
}: {
  card: ExamFocusCardData;
  bookId: string;
  position: number;
  total: number;
  onToggleBookmark: () => void;
}) {
  const info = categoryInfo(card.category);
  const firstPage = card.sourcePages[0];
  return (
    <article
      className={`ef-card ef-cat-${card.category}`}
      dir="ltr"
      aria-roledescription="card"
      aria-label={`${info.label}: ${card.title} — ${position} / ${total}`}
    >
      <div className="ef-card-top">
        <span className="ef-badge">
          <span aria-hidden="true">{info.emoji}</span>
          <span>{info.label.toUpperCase()}</span>
          <span className="ef-badge-ar" lang="ar" dir="rtl">
            {info.labelAr}
          </span>
        </span>
        <button
          type="button"
          className={`ef-bookmark ${card.bookmarked ? "is-on" : ""}`}
          onClick={onToggleBookmark}
          aria-pressed={card.bookmarked}
          aria-label={
            card.bookmarked ? "إزالة من المحفوظة" : "احفظ للمراجعة لاحقًا"
          }
        >
          <Bookmark
            size={18}
            fill={card.bookmarked ? "currentColor" : "none"}
          />
        </button>
      </div>

      {card.topic && <p className="ef-topic">{card.topic}</p>}
      <h2 className="ef-title">{card.title}</h2>

      <ul className="ef-points">
        {card.points.map((point, i) => (
          <li key={i}>
            <Highlighted text={stripBullet(point)} />
          </li>
        ))}
      </ul>

      {card.highlightText && (
        <div className="ef-highlight">
          <span className="ef-highlight-label">
            <span aria-hidden="true">💡 </span>
            {card.highlightLabel || "KEY POINT"}
          </span>
          <p>
            <Highlighted text={card.highlightText} />
          </p>
        </div>
      )}

      {card.flag && (
        <div className="ef-flag" role="note">
          <span aria-hidden="true">⚠️ </span>
          <strong>Source note:</strong> {card.flag}
        </div>
      )}

      <footer className="ef-card-foot">
        {firstPage ? (
          <Link
            href={`/books/${bookId}/read?page=${firstPage}&from=exam-focus`}
            className="ef-source"
            aria-label={`افتح المصدر: صفحة ${firstPage}`}
          >
            <BookOpen size={14} aria-hidden="true" />
            Source: {pagesLabel(card.sourcePages)}
          </Link>
        ) : (
          <span />
        )}
        <span className="ef-card-count">
          {position} / {total}
        </span>
      </footer>
    </article>
  );
}
