"use client";

import { useState, type ReactNode } from "react";
import { Check, Globe, Loader2, MessageSquare, Share } from "lucide-react";
import StudyShell from "./StudyShell";
import StudyAiSheet, { type AiTarget } from "./StudyAiSheet";
import type { MedicalNotePage } from "@/lib/medical-note-composer";
import type { SummarySection } from "@/lib/document-coverage";

export type SummaryChapter = {
  id: string;
  title: string;
  startPage?: number;
  endPage?: number;
  chapterSummary: string | null;
  explanationEn: string | null;
  explanationAr: string | null;
  keyPoints: string[] | null;
  medicalNotePages: MedicalNotePage[] | null;
  // Per-chunk summaries with their real page ranges (coverage manifest) —
  // shown so the summary is verifiably built from every part of the file.
  summarySections?: SummarySection[];
};

const TONE_ICON: Record<MedicalNotePage["blocks"][number]["tone"], string> = {
  warning: "⚠️",
  high_yield: "⚡",
  clinical: "🩺",
  default: "",
};

function pagesLabel(pages: number[]): string {
  if (!pages.length) return "";
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  return sorted.length === 1
    ? `p. ${sorted[0]}`
    : `p. ${sorted[0]}–${sorted[sorted.length - 1]}`;
}

// Full-screen, document-style reading of one chapter's — or, from the
// book-wide study page, EVERY chapter's — summary: blue section headings,
// the AI Medical Note pages when composed, else explanation + per-part
// summaries (each with its real page range) + high-yield points. The globe
// switches English ⇄ Arabic wherever both exist; the floating button opens
// the AI chat (chapter- or book-scoped).
export default function SummaryMode({
  bookTitle,
  chapters,
  subtitle,
  notice,
  aiTarget,
  onBack,
  onComposeNotes,
  composingChapterId,
}: {
  bookTitle: string;
  chapters: SummaryChapter[];
  subtitle?: string;
  notice?: ReactNode;
  aiTarget: AiTarget;
  onBack: () => void;
  // Absent for a shared (read-only) Study Pack — composing is owner-only.
  onComposeNotes?: (chapterId: string) => void;
  composingChapterId: string | null;
}) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [aiOpen, setAiOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const isEn = lang === "en";
  const dir = isEn ? "ltr" : "rtl";
  const multi = chapters.length > 1;

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: bookTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      // The user dismissing the share sheet isn't an error worth showing.
    }
  }

  return (
    <StudyShell
      title="الملخص"
      subtitle={subtitle ?? chapters[0]?.title}
      notice={notice}
      onBack={onBack}
      actions={
        <>
          <button
            type="button"
            className="study-icon-button"
            onClick={() => setLang(l => (l === "en" ? "ar" : "en"))}
            aria-label={isEn ? "عرض بالعربي" : "Show in English"}
            title={isEn ? "عربي" : "English"}
          >
            <Globe size={20} />
          </button>
          <button
            type="button"
            className="study-icon-button"
            onClick={share}
            aria-label="مشاركة"
          >
            {shared ? <Check size={20} /> : <Share size={20} />}
          </button>
        </>
      }
    >
      <article className="summary-doc" dir={dir}>
        <p className="summary-doc-book" dir="auto">
          {bookTitle}
        </p>

        {chapters.map(chapter => {
          const explanation = isEn
            ? chapter.explanationEn || chapter.explanationAr
            : chapter.explanationAr || chapter.explanationEn;
          const range =
            chapter.startPage && chapter.endPage
              ? `pages ${chapter.startPage}–${chapter.endPage}`
              : "";
          return (
            <div key={chapter.id} className="summary-doc-chapter">
              <h1 className="summary-doc-title" dir="auto">
                {chapter.title}
                {range && <small className="summary-doc-range">{range}</small>}
              </h1>

              {chapter.chapterSummary && (
                <p
                  className={isEn ? "summary-doc-lead en" : "summary-doc-lead"}
                  dir="ltr"
                >
                  {chapter.chapterSummary}
                </p>
              )}

              {chapter.medicalNotePages?.length ? (
                chapter.medicalNotePages.map((page, pageIndex) => (
                  <section
                    key={`${page.title}-${pageIndex}`}
                    className="summary-doc-section"
                  >
                    <h2>
                      {page.title}
                      {!!page.sourcePages.length && (
                        <small className="summary-doc-range">
                          {pagesLabel(page.sourcePages)}
                        </small>
                      )}
                    </h2>
                    {page.subtitle && (
                      <p className="summary-doc-subtitle">{page.subtitle}</p>
                    )}
                    {page.blocks.map((block, blockIndex) => {
                      const body = isEn
                        ? block.bodyEn || block.bodyAr
                        : block.bodyAr || block.bodyEn;
                      return (
                        <div
                          key={`${block.heading}-${blockIndex}`}
                          className={`summary-doc-block tone-${block.tone}`}
                        >
                          <h3>
                            {TONE_ICON[block.tone] && (
                              <span>{TONE_ICON[block.tone]} </span>
                            )}
                            {block.heading}
                          </h3>
                          {body && <p>{body}</p>}
                          {!!block.items.length && (
                            <ul>
                              {block.items.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </section>
                ))
              ) : (
                <>
                  {(chapter.summarySections?.length ?? 0) > 1 && (
                    <section className="summary-doc-section">
                      <h2>{isEn ? "Part by part" : "ملخص كل جزء"}</h2>
                      {chapter.summarySections!.map(section => (
                        <div
                          key={section.chunkId}
                          className="summary-doc-block"
                        >
                          <h3>
                            <small className="summary-doc-range">
                              {pagesLabel([section.pageStart, section.pageEnd])}
                            </small>
                          </h3>
                          <p dir="auto">{section.summary}</p>
                        </div>
                      ))}
                    </section>
                  )}
                  {explanation && (
                    <section className="summary-doc-section">
                      <h2>{isEn ? "Explanation" : "الشرح"}</h2>
                      <p className="summary-doc-body">{explanation}</p>
                    </section>
                  )}
                  {onComposeNotes && (
                    <div className="summary-doc-compose">
                      <p>
                        حوّل هذا الجزء إلى ملخص طبي منظم: تعريف، أعراض، تشخيص،
                        علاج، ونقاط خطر.
                      </p>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={composingChapterId !== null}
                        onClick={() => onComposeNotes(chapter.id)}
                      >
                        {composingChapterId === chapter.id ? (
                          <Loader2 size={15} className="spin" />
                        ) : (
                          "✨"
                        )}{" "}
                        تجهيز ملخص منظم
                      </button>
                    </div>
                  )}
                </>
              )}

              {!!chapter.keyPoints?.length && (
                <section className="summary-doc-section">
                  <h2>⚡ High-Yield</h2>
                  <ul className="summary-doc-keypoints" dir="ltr">
                    {chapter.keyPoints.map((point, i) => (
                      <li key={i} className="en">
                        {point}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {multi && <hr className="summary-doc-divider" />}
            </div>
          );
        })}
      </article>

      <button
        type="button"
        className="summary-chat-fab"
        onClick={() => setAiOpen(true)}
        aria-label="اسأل المساعد"
      >
        <MessageSquare size={26} />
      </button>

      <StudyAiSheet
        target={aiTarget}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
      />
    </StudyShell>
  );
}
