import { auth } from "@/lib/auth";
import { detectChapters } from "@/lib/book-chapters";
import { createBookWithChapters } from "@/lib/db-books";
import { normalizePageText } from "@/lib/pdf-cards";
import { storageGetSignedUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts for why.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Step 2 of the book pipeline: the browser already PUT the raw file straight
// to storage via /api/books/upload-url. This route extracts all page text,
// detects chapter boundaries (lib/book-chapters.ts), and persists the whole
// book + its full chapter row set up front (all "pending") — this is what
// makes the pipeline resumable without a job queue: chapter analysis
// (/api/books/analyze-chapter) is driven by the client one chapter at a
// time afterward, and "pending" rows are themselves the resume marker.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    fileName?: string;
  };
  const key = typeof body.key === "string" ? body.key : "";
  const fileName = typeof body.fileName === "string" ? body.fileName : "";

  if (!key) {
    return NextResponse.json({ error: "ارفع ملف PDF أولًا." }, { status: 400 });
  }
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "الملف يجب أن يكون بصيغة PDF." },
      { status: 400 }
    );
  }

  let parser: PDFParse | undefined;
  try {
    const signedGetUrl = await storageGetSignedUrl(key);
    parser = new PDFParse({ url: signedGetUrl, CanvasFactory });
    const result = await parser.getText();
    const pages = result.pages.map(page => ({
      page: page.num,
      text: normalizePageText(page.text),
    }));

    if (!pages.length) {
      return NextResponse.json(
        { error: "تعذر قراءة أي صفحة من هذا الملف." },
        { status: 422 }
      );
    }

    const { chapters, method } = detectChapters(pages);
    const pagesByChapter = chapters.map(chapter =>
      pages.filter(
        page => page.page >= chapter.startPage && page.page <= chapter.endPage
      )
    );

    const created = await createBookWithChapters(session.user.id, {
      fileName,
      fileKey: key,
      pageCount: result.total,
      method,
      chapters,
      pagesByChapter,
    });

    return NextResponse.json({
      bookId: created.book.id,
      chapters: created.chapters.map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        startPage: chapter.startPage,
        endPage: chapter.endPage,
      })),
    });
  } catch (error) {
    console.error("[Books] Extraction/planning failed", error);
    return NextResponse.json(
      {
        error:
          "تعذر قراءة الملف أو تقسيمه إلى فصول. جرّب نسخة PDF قابلة لتحديد النص.",
      },
      { status: 422 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
