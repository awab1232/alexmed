import {
  finalizeBookExtraction,
  getBookById,
  markBookExtractionFailed,
  updateBookExtractionProgress,
  type BookPageText,
} from "@/lib/db-books";
import { findMissingPageNumbers, normalizePageText } from "@/lib/pdf-cards";
import { ocrPages } from "@/lib/pdf-ocr";
import { publishMessage } from "@/lib/queue/client";
import { storageGetSignedUrl } from "@/lib/storage";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts for why.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value — this route processes at most one OCR batch (≤4 pages) per
// invocation, same reasoning as app/api/mirror/extract/route.ts.
export const maxDuration = 60;

const OCR_BATCH_SIZE = 4;

// كتبي's counterpart to app/api/mirror/extract/route.ts — see that file's
// comment for the full design. extract-and-plan creates a bare book row
// (status "extracting") and publishes one extract_book_job message; this
// worker does the PDF text-extraction + OCR, resuming across invocations via
// the book's own pageTexts/pagesNeedingOcr staging columns until every page
// has usable text, then runs detectChapters() (finalizeBookExtraction) and
// hands off to the existing analyze_book_chapter workers.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request.url);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let bookId: string;
  let book: Awaited<ReturnType<typeof getBookById>>;
  try {
    const body = JSON.parse(rawBody) as { bookId?: string };
    bookId = typeof body.bookId === "string" ? body.bookId : "";
    if (!bookId) {
      return NextResponse.json(
        { error: "معرف الكتاب مفقود." },
        { status: 200 }
      );
    }

    book = await getBookById(bookId);
    if (!book) {
      return NextResponse.json({ bookId, status: "skipped" });
    }
    if (book.status !== "extracting") {
      return NextResponse.json({ bookId, status: "already_done" });
    }
  } catch (error) {
    console.error("[Books] Extraction lookup failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذا الكتاب." },
      { status: 502 }
    );
  }

  let parser: PDFParse | undefined;
  try {
    const signedGetUrl = await storageGetSignedUrl(book.fileKey ?? "");
    parser = new PDFParse({ url: signedGetUrl, CanvasFactory });

    let pages: BookPageText[];
    let pagesNeedingOcr: number[];
    let ocrFailedPages: number[];
    let totalPages: number;

    if (!book.pageTexts) {
      const result = await parser.getText();
      pages = result.pages.map(page => {
        const text = normalizePageText(page.text);
        return { page: page.num, text, hasText: text.length > 0 };
      });
      totalPages = result.total;

      if (!pages.length) {
        await markBookExtractionFailed(
          bookId,
          "تعذر قراءة أي صفحة من هذا الملف."
        );
        return NextResponse.json({ bookId, status: "failed" });
      }

      pagesNeedingOcr = pages
        .filter(page => !page.hasText)
        .map(page => page.page);
      ocrFailedPages = [];
      await updateBookExtractionProgress(bookId, {
        pageCount: totalPages,
        pageTexts: pages,
        pagesNeedingOcr,
        ocrFailedPages,
      });
    } else {
      pages = book.pageTexts;
      pagesNeedingOcr = book.pagesNeedingOcr ?? [];
      ocrFailedPages = book.ocrFailedPages ?? [];
      totalPages = book.pageCount;
    }

    if (pagesNeedingOcr.length) {
      const batch = pagesNeedingOcr.slice(0, OCR_BATCH_SIZE);
      const { pages: ocrResults, failedPages } = await ocrPages(parser, batch);
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
      const remainingOcr = pagesNeedingOcr.slice(OCR_BATCH_SIZE);
      ocrFailedPages = [...ocrFailedPages, ...failedPages];

      await updateBookExtractionProgress(bookId, {
        pageTexts: pages,
        pagesNeedingOcr: remainingOcr,
        ocrFailedPages,
      });

      if (remainingOcr.length) {
        await publishMessage(
          { type: "extract_book_job", bookId },
          { flowControl: { key: `books-extract-${bookId}`, parallelism: 1 } }
        );
        return NextResponse.json({
          bookId,
          status: "extracting",
          remaining: remainingOcr.length,
        });
      }
    }

    const missingPages = findMissingPageNumbers(pages, totalPages);
    const unreadablePages = pages
      .filter(page => !page.hasText)
      .map(page => page.page);
    if (
      missingPages.length ||
      unreadablePages.length ||
      ocrFailedPages.length
    ) {
      const pagesToRetry = Array.from(
        new Set([...missingPages, ...unreadablePages, ...ocrFailedPages])
      ).sort((a, b) => a - b);
      await markBookExtractionFailed(
        bookId,
        `لم نتمكن من قراءة كل صفحات الكتاب. الصفحات التي تحتاج إعادة معالجة: ${pagesToRetry.join(", ")}`
      );
      return NextResponse.json({
        bookId,
        status: "failed",
        pages: pagesToRetry,
      });
    }

    const { chapters } = await finalizeBookExtraction(bookId, pages);

    try {
      await Promise.all(
        chapters.map(chapter =>
          publishMessage({
            type: "analyze_book_chapter",
            chapterId: chapter.id,
            bookId,
          })
        )
      );
    } catch (publishError) {
      console.error(
        "[Books] Failed to enqueue chapters after extraction",
        publishError
      );
      return NextResponse.json(
        { error: "تعذر بدء تحليل الفصول." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      bookId,
      status: "extracted",
      chapterCount: chapters.length,
    });
  } catch (error) {
    console.error("[Books] Extraction failed", error);
    return NextResponse.json(
      { error: "تعذر قراءة الملف أو تقسيمه إلى فصول." },
      { status: 502 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
