import { auth } from "@/lib/auth";
import { createMirrorJobWithBatches } from "@/lib/db-mirror";
import { findMissingPageNumbers, normalizePageText } from "@/lib/pdf-cards";
import { ocrPages } from "@/lib/pdf-ocr";
import { publishMessage } from "@/lib/queue/client";
import { storageGetSignedUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts for why.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value — this route runs OCR calls in addition to plain text
// extraction, same as كتبي's extract-and-plan route.
export const maxDuration = 60;

const OCR_BATCH_SIZE = 4;

// Step 2 of the مِرآة pipeline (Item D of the reliability plan): the browser
// already PUT the raw file straight to storage via /api/pdf/upload-url. This
// route extracts all page text, OCRs any page pdf-parse couldn't extract
// text from, and persists the whole job + its full batch row set up front
// (all "pending") — this is what makes generation resumable across devices
// without a job queue, mirroring كتبي's /api/books/extract-and-plan exactly:
// /api/mirror/generate-batch is driven by the client one batch at a time
// afterward, and "pending" rows are themselves the resume marker.
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
    depth?: string;
  };
  const key = typeof body.key === "string" ? body.key : "";
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const depth =
    body.depth === "detailed"
      ? "detailed"
      : body.depth === "quick"
        ? "quick"
        : "balanced";

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
          error: `لم نتمكن من قراءة كل صفحات الملف. الصفحات التي تحتاج إعادة معالجة: ${pagesToRetry.join(", ")}`,
          pages: pagesToRetry,
        },
        { status: 422 }
      );
    }

    const { job, batches } = await createMirrorJobWithBatches(session.user.id, {
      fileName,
      fileKey: key,
      pageCount: result.total,
      depth,
      pages,
    });

    // Publish one QStash message per batch — this is what starts background
    // generation; the client only ever polls job/batch status from here on
    // (see app/mirror/[jobId]/page.tsx), it never calls generate-batch
    // itself. Publish failures here would strand a batch in "pending"
    // forever with nothing to wake it, so surface that as a real error
    // rather than silently returning a job the queue never picks up.
    try {
      await Promise.all(
        batches.map(batch =>
          publishMessage({
            type: "generate_mirror_batch",
            batchId: batch.id,
            jobId: job.id,
          })
        )
      );
    } catch (publishError) {
      console.error("[Mirror] Failed to enqueue batches", publishError);
      return NextResponse.json(
        {
          error: "تم إنشاء الملف لكن تعذر بدء المعالجة. حاول إعادة رفع الملف.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      jobId: job.id,
      batchCount: batches.length,
    });
  } catch (error) {
    console.error("[Mirror] Upload/planning failed", error);
    return NextResponse.json(
      {
        error:
          "تعذر قراءة الملف أو تجهيزه للتوليد. جرّب نسخة PDF قابلة لتحديد النص.",
      },
      { status: 422 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
