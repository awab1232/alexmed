"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const RATE_LIMIT_MAX_RETRIES = 3;
const BATCH_RETRY_MAX_RETRIES = 2;
const BATCH_RETRY_DELAY_MS = 4000;
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

async function analyzeChapter(
  chapterId: string,
  onWarning: (message: string) => void
): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null;
    let data: { error?: string; retryAfterMs?: number } | null = null;
    try {
      response = await fetch("/api/books/analyze-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId }),
      });
      data = await response.json();
    } catch {
      // falls through to the retry policy below, same as a non-ok response
    }

    if (response?.ok) return true;

    const isRateLimited = response?.status === 429;
    const canRetry = isRateLimited
      ? attempt < RATE_LIMIT_MAX_RETRIES
      : attempt < BATCH_RETRY_MAX_RETRIES;

    if (canRetry) {
      const waitMs = isRateLimited
        ? typeof data?.retryAfterMs === "number"
          ? data.retryAfterMs
          : 20_000
        : BATCH_RETRY_DELAY_MS;
      onWarning(
        isRateLimited
          ? `تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي — ننتظر ${Math.ceil(waitMs / 1000)} ثانية...`
          : "تعذر تحليل هذا الفصل، جارٍ إعادة المحاولة..."
      );
      await sleep(waitMs);
      continue;
    }

    return false;
  }
}

export default function BookDetailPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;
  const bookQuery = trpc.books.get.useQuery({ id: bookId });
  const utils = trpc.useUtils();
  const [warning, setWarning] = useState("");
  const resumingRef = useRef(false);

  // Resumability (see the approved plan's Decision 1): loading this page
  // just re-queries chapter statuses — any "pending" or "failed" chapter
  // picks the loop back up automatically, exactly where it left off,
  // whether that's a fresh upload or the student returning after closing
  // the tab mid-book.
  useEffect(() => {
    if (!bookQuery.data || resumingRef.current) return;
    const pending = bookQuery.data.chapters.filter(
      chapter => chapter.status === "pending" || chapter.status === "failed"
    );
    if (!pending.length) return;

    resumingRef.current = true;
    let cancelled = false;

    (async () => {
      for (const chapter of pending) {
        if (cancelled) break;
        await analyzeChapter(chapter.id, setWarning);
        setWarning("");
        if (!cancelled) await utils.books.get.invalidate({ id: bookId });
      }
      resumingRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [bookQuery.data, bookId, utils]);

  if (bookQuery.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل الكتاب...</h3>
        </div>
      </section>
    );
  }

  if (!bookQuery.data) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر العثور على هذا الكتاب</h3>
          <Link
            href="/books"
            className="secondary-button"
            style={{ marginTop: 12 }}
          >
            العودة لكتبي
          </Link>
        </div>
      </section>
    );
  }

  const { book, chapters } = bookQuery.data;
  const completeCount = chapters.filter(c => c.status === "complete").length;
  const isProcessing = chapters.some(
    c => c.status === "pending" || c.status === "analyzing"
  );

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link href="/books" className="eyebrow" style={{ marginBottom: 8 }}>
            <span className="eyebrow-dot" /> ‹ رجوع لكتبي
          </Link>
          <h1>{book.fileName}</h1>
          <p>
            {book.pageCount} صفحة · {chapters.length} فصل · {completeCount}/
            {chapters.length} مكتمل
          </p>
        </div>
      </div>

      {warning && (
        <div className="inline-alert warning wide">
          <CircleAlert size={16} />
          {warning}
        </div>
      )}
      {isProcessing && !warning && (
        <div className="inline-alert warning wide">
          <Loader2 size={16} className="spin" />
          جاري تحليل الفصول — تقدر تسكّر الصفحة وترجع بعدين، مش هنفقد أي تقدم.
        </div>
      )}

      <div className="library-grid">
        {chapters.map(chapter => (
          <Link
            href={
              chapter.status === "complete"
                ? `/books/${bookId}/chapters/${chapter.id}`
                : "#"
            }
            className="library-item"
            key={chapter.id}
            style={
              chapter.status !== "complete"
                ? { pointerEvents: "none", opacity: 0.6 }
                : undefined
            }
          >
            <div className="library-item-icon">
              {chapter.status === "complete" && <CheckCircle2 size={18} />}
              {chapter.status === "failed" && <CircleAlert size={18} />}
              {(chapter.status === "pending" ||
                chapter.status === "analyzing") && (
                <Loader2 size={18} className="spin" />
              )}
            </div>
            <div className="library-item-meta">
              <strong>{chapter.title}</strong>
              <span>
                صفحة {chapter.startPage}–{chapter.endPage} ·{" "}
                {chapter.status === "complete"
                  ? "مكتمل"
                  : chapter.status === "failed"
                    ? "تعذر التحليل"
                    : chapter.status === "analyzing"
                      ? "جارٍ التحليل..."
                      : "بالانتظار"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
