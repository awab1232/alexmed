"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// Background analysis now happens entirely server-side, driven by Upstash
// QStash workers (see app/api/books/analyze-chapter/route.ts) — this page's
// only job is to poll chapter status and show simple aggregate progress. It
// never calls analyze-chapter itself, so closing the tab or losing
// connection never stops analysis; reopening this page just resumes showing
// the same server-side progress.
const POLL_INTERVAL_MS = 3000;
const TERMINAL_BOOK_STATUSES = new Set(["complete", "partial_failed"]);

export default function BookDetailPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;
  const utils = trpc.useUtils();
  const bookQuery = trpc.books.get.useQuery(
    { id: bookId },
    {
      refetchInterval: query => {
        const status = query.state.data?.book.status;
        return status && TERMINAL_BOOK_STATUSES.has(status)
          ? false
          : POLL_INTERVAL_MS;
      },
    }
  );
  const retryChapter = trpc.books.retryChapter.useMutation({
    onSuccess: () => utils.books.get.invalidate({ id: bookId }),
  });

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
  const failedChapters = chapters.filter(c => c.status === "failed");
  const isProcessing =
    book.status !== "complete" && book.status !== "partial_failed";

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

      {isProcessing && (
        <div className="inline-alert warning wide">
          <Loader2 size={16} className="spin" />
          جاري تحليل الفصول — تقدر تسكّر الصفحة وترجع بعدين من أي جهاز، مش
          هنفقد أي تقدم.
        </div>
      )}

      {book.status === "partial_failed" && (
        <div className="inline-alert warning wide">
          <CircleAlert size={16} />
          اكتمل معظم الكتاب، لكن {failedChapters.length} فصل تعذّر تحليله.
          يمكنك إعادة محاولته أدناه.
        </div>
      )}

      <div className="library-grid">
        {chapters.map(chapter => (
          <div className="library-item" key={chapter.id}>
            {chapter.status === "complete" ? (
              <Link
                href={`/books/${bookId}/chapters/${chapter.id}`}
                className="library-item-icon"
                style={{ display: "contents" }}
              >
                <div className="library-item-icon">
                  <CheckCircle2 size={18} />
                </div>
                <div className="library-item-meta">
                  <strong>{chapter.title}</strong>
                  <span>
                    صفحة {chapter.startPage}–{chapter.endPage} · مكتمل
                  </span>
                </div>
              </Link>
            ) : (
              <>
                <div className="library-item-icon">
                  {chapter.status === "failed" ? (
                    <CircleAlert size={18} />
                  ) : (
                    <Loader2 size={18} className="spin" />
                  )}
                </div>
                <div className="library-item-meta">
                  <strong>{chapter.title}</strong>
                  <span>
                    صفحة {chapter.startPage}–{chapter.endPage} ·{" "}
                    {chapter.status === "failed"
                      ? chapter.errorMessage || "تعذر التحليل"
                      : "جارٍ التحليل..."}
                  </span>
                </div>
                {chapter.status === "failed" && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={retryChapter.isPending}
                    onClick={() =>
                      retryChapter.mutate({ chapterId: chapter.id })
                    }
                  >
                    <RotateCcw size={14} /> إعادة المحاولة
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
