"use client";

import Link from "next/link";
import { BookOpen, CircleAlert, Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// كتبي home/index — doubles as the "فهرس كتبي" the sidebar links to as well,
// since there's nothing this page's content would show differently as a
// separate route (see the approved plan's UI-structure decision).
export default function BooksHomePage() {
  const booksQuery = trpc.books.list.useQuery();

  return (
    <section className="upload-view">
      <div className="cards-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> كتبي
          </div>
          <h1>
            كتبك <em>كلها هنا.</em>
          </h1>
          <p>ارفع كتابك، وخلّينا نقسّمه لك لفصول صغيرة وسهلة.</p>
        </div>
        <div className="header-actions">
          <Link href="/books/upload" className="secondary-button">
            <Plus size={16} /> رفع كتاب جديد
          </Link>
        </div>
      </div>

      {booksQuery.isError ? (
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر تحميل كتبك</h3>
          <p>تحقق من اتصالك وحاول مرة أخرى.</p>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 14 }}
            onClick={() => booksQuery.refetch()}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : booksQuery.isLoading ? (
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل كتبك...</h3>
        </div>
      ) : !booksQuery.data?.length ? (
        <div className="empty-state">
          <BookOpen size={28} />
          <h3>مافيش كتب لسه</h3>
          <p>ارفع أول كتاب وهنقسّمه لك لفصول صغيرة وسهلة.</p>
        </div>
      ) : (
        <div className="library-grid">
          {booksQuery.data.map(book => {
            const progress = book.chapterCount
              ? Math.round(
                  (Number(book.completeChapterCount) /
                    Number(book.chapterCount)) *
                    100
                )
              : 0;
            return (
              <Link
                href={`/books/${book.id}`}
                className="library-item"
                key={book.id}
              >
                <div className="library-item-icon">
                  <BookOpen size={18} />
                </div>
                <div className="library-item-meta">
                  <strong>{book.fileName}</strong>
                  <span>
                    {book.pageCount} صفحة · {book.completeChapterCount}/
                    {book.chapterCount} فصل مكتمل · {progress}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
