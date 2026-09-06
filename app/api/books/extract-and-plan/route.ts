import { auth } from "@/lib/auth";
import { detectChapters } from "@/lib/book-chapters";
import { createBookWithChapters } from "@/lib/db-books";
import { findMissingPageNumbers, normalizePageText } from "@/lib/pdf-cards";
import { ocrPages } from "@/lib/pdf-ocr";
import { publishMessage } from "@/lib/queue/client";
import { storageGetSignedUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts for why.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value — set explicitly since this route now runs OCR calls (see
// below) in addition to plain text extraction.
export const maxDuration = 60;

// How many scanned pages get OCR'd per sequential ocrPages() call — mirrors
// مِرآة's own client-side batching (components/Home.tsx) and the hard cap
// ocrPages() itself enforces.
const OCR_BATCH_SIZE = 4;

// Step 2 of the book pipeline: the browser already PUT the raw file straight
// to storage via /api/books/upload-url. This route extracts all page text,
// OCRs any page pdf-parse couldn't extract text from (scanned/image-only
// pages — same signal مِرآة uses, see app/api/pdf/extract/route.ts), detects
// chapter boundaries (lib/book-chapters.ts) against the now-complete text,
// and persists the whole book + its full chapter row set up front (all
// "pending") — this is what makes the pipeline resumable without a job
// queue: chapter analysis (/api/books/analyze-chapter) is driven by the
// client one chapter at a time afterward, and "pending" rows are themselves
// the resume marker.
//
// Known limitation, deliberately out of scope here: a scanned book with many
// pages needing OCR runs those calls sequentially (same OmniRoute
// concurrency=1 constraint as مِرآة's card generation — see components/
// Home.tsx) inside this route's own 60s budget, so a large scanned book can
// still time out. Fixing that needs a resumable step (like Item D's
// pattern), not attempted here — the goal of this fix is making scanned
// books work at all, not every size of scanned book.
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
    let pages = result.pages.map(page => {
      const text = normalizePageText(page.text);
      return { page: page.num, text, hasText: text.length > 0 };
    });

    if (!pages.length) {
      return NextResponse.json(
        { error: "تعذر قراءة أي صفحة من هذا الملف." },
        { status: 422 }
      );
    }

    const pagesNeedingOcr = pages
      .filter(page => !page.hasText)
      .map(page => page.page);

    const failedOcrPages: number[] = [];
    for (
      let index = 0;
      index < pagesNeedingOcr.length;
      index += OCR_BATCH_SIZE
    ) {
      const batch = pagesNeedingOcr.slice(index, index + OCR_BATCH_SIZE);
      const { pages: ocrResults, failedPages } = await ocrPages(parser, batch);
      failedOcrPages.push(...failedPages);
      const ocrByPage = new Map(ocrResults.map(page => [page.page, page]));
      pages = pages.map(page => {
        const ocrResult = ocrByPage.get(page.page);
        return ocrResult
          ? {
              page: page.page,
              text: ocrResult.text,
              hasText: ocrResult.hasText,
            }
          : page;
      });
    }

    const missingPages = findMissingPageNumbers(pages, result.total);
    const unreadablePages = pages
      .filter(page => !page.hasText)
      .map(page => page.page);
    if (
      missingPages.length ||
      unreadablePages.length ||
      failedOcrPages.length
    ) {
      const pagesToRetry = Array.from(
        new Set([...missingPages, ...unreadablePages, ...failedOcrPages])
      ).sort((a, b) => a - b);
      return NextResponse.json(
        {
          error: `لم نتمكن من قراءة كل صفحات الكتاب. الصفحات التي تحتاج إعادة معالجة: ${pagesToRetry.join(", ")}`,
          pages: pagesToRetry,
        },
        { status: 422 }
      );
    }

    const pageTexts = pages.map(({ page, text }) => ({ page, text }));
    const { chapters, method } = detectChapters(pageTexts);
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

    // Publish one QStash message per chapter — analysis now happens in the
    // background; the client only ever polls chapter status from here on
    // (see app/books/[bookId]/page.tsx).
    try {
      await Promise.all(
        created.chapters.map(chapter =>
          publishMessage({
            type: "analyze_book_chapter",
            chapterId: chapter.id,
            bookId: created.book.id,
          })
        )
      );
    } catch (publishError) {
      console.error("[Books] Failed to enqueue chapters", publishError);
      return NextResponse.json(
        {
          error: "تم إنشاء الكتاب لكن تعذر بدء التحليل. حاول إعادة رفع الملف.",
        },
        { status: 502 }
      );
    }

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
