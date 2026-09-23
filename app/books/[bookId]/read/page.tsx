"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// Dedicated PDF read page — a real "open the file" experience via the
// browser's own native PDF viewer (<iframe> pointed straight at the signed
// file URL) instead of a custom in-page canvas renderer. This sidesteps the
// custom renderer's blank-page/CORS-range-request failure modes entirely
// and gets real text selection, copy, search, print and (in Chromium) the
// browser's own built-in highlight/note tools for free — none of which the
// custom renderer had. See app/books/[bookId]/page.tsx's "عرض الملف" button.
export default function BookReadPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;
  const bookQuery = trpc.books.get.useQuery({ id: bookId });

  if (bookQuery.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل الملف...</h3>
        </div>
      </section>
    );
  }

  const book = bookQuery.data?.book;
  if (!book || !book.fileKey) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر العثور على هذا الملف</h3>
          <Link
            href={`/books/${bookId}`}
            className="secondary-button"
            style={{ marginTop: 12 }}
          >
            العودة للملف
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="pdf-reader-page">
      <div className="cards-header">
        <div>
          <Link
            href={`/books/${bookId}`}
            className="eyebrow"
            style={{ marginBottom: 8 }}
          >
            <span className="eyebrow-dot" /> ‹ رجوع
          </Link>
          <h1>{book.fileName}</h1>
        </div>
      </div>
      <iframe
        src={`/api/files/${book.fileKey}`}
        title={book.fileName}
        className="pdf-reader-frame"
      />
    </section>
  );
}
