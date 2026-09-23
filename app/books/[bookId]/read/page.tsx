"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import PdfViewer from "@/components/PdfViewer";

// Dedicated PDF read page — a real "open the file" experience: back button
// up top, the actual original PDF underneath, rendered by our own pdf.js
// viewer with a real تضليل/قلم/ممحاة layer on every page (see
// components/PdfViewer.tsx and lib/pdf-marks.ts). See
// app/books/[bookId]/page.tsx's "عرض الملف" button.
export default function BookReadPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;
  const bookQuery = trpc.books.get.useQuery({ id: bookId });

  // The page underneath the fixed reader shouldn't scroll/rubber-band.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

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

  // Full-screen reader, like opening a PDF on the iPhone: a fixed shell over
  // the whole viewport (covering BottomNav); back/title/page count live in
  // PdfViewer's own top bar.
  return (
    <section className="pdf-reader-page">
      <PdfViewer
        bookId={bookId}
        src={`/api/files/${book.fileKey}`}
        fileName={book.fileName}
        backHref={`/books/${bookId}`}
      />
    </section>
  );
}
