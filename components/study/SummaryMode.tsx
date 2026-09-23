"use client";

import { useState } from "react";
import { Check, Globe, Loader2, MessageSquare, Share } from "lucide-react";
import StudyShell from "./StudyShell";
import StudyAiSheet from "./StudyAiSheet";
import type { MedicalNotePage } from "@/lib/medical-note-composer";

export type SummaryChapter = {
  id: string;
  title: string;
  chapterSummary: string | null;
  explanationEn: string | null;
  explanationAr: string | null;
  keyPoints: string[] | null;
  medicalNotePages: MedicalNotePage[] | null;
};

const TONE_ICON: Record<MedicalNotePage["blocks"][number]["tone"], string> = {
  warning: "⚠️",
  high_yield: "⚡",
  clinical: "🩺",
  default: "",
};

// Full-screen, document-style reading of a chapter's summary (like a notes
// app page): blue section headings, the AI Medical Note pages when they've
// been composed, else overview → explanation → high-yield points. The globe
// switches English ⇄ Arabic wherever both exist; the floating button opens
// the chapter-scoped AI chat.
export default function SummaryMode({
  bookTitle,
  chapter,
  onBack,
  onComposeNotes,
  composing,
}: {
  bookTitle: string;
  chapter: SummaryChapter;
  onBack: () => void;
  onComposeNotes: () => void;
  composing: boolean;
}) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [aiOpen, setAiOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const isEn = lang === "en";
  const dir = isEn ? "ltr" : "rtl";

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${bookTitle} — ${chapter.title}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      // The user dismissing the share sheet isn't an error worth showing.
    }
  }

  const explanation = isEn
    ? chapter.explanationEn || chapter.explanationAr
    : chapter.explanationAr || chapter.explanationEn;

  return (
    <StudyShell
      title="الملخص"
      subtitle={chapter.title}
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
        <h1 className="summary-doc-title" dir="auto">
          {chapter.title}
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
              <h2>{page.title}</h2>
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
            {explanation && (
              <section className="summary-doc-section">
                <h2>{isEn ? "Explanation" : "الشرح"}</h2>
                <p className="summary-doc-body">{explanation}</p>
              </section>
            )}
            <div className="summary-doc-compose">
              <p>
                حوّل هذا الجزء إلى ملخص طبي منظم: تعريف، أعراض، تشخيص، علاج،
                ونقاط خطر.
              </p>
              <button
                type="button"
                className="secondary-button"
                disabled={composing}
                onClick={onComposeNotes}
              >
                {composing ? <Loader2 size={15} className="spin" /> : "✨"}{" "}
                تجهيز ملخص منظم
              </button>
            </div>
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
        chapterId={chapter.id}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
      />
    </StudyShell>
  );
}
