import {
  finalizeMirrorJobExtraction,
  getMirrorJobById,
  markMirrorJobExtractionFailed,
  updateMirrorJobExtractionProgress,
  type MirrorPageText,
} from "@/lib/db-mirror";
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
// invocation specifically so it never approaches that ceiling, no matter how
// many pages the file needs OCR'd (see the self-chaining publish below).
export const maxDuration = 60;

const OCR_BATCH_SIZE = 4;

// Step 1 of the مِرآة pipeline, background half: upload-and-plan creates a
// bare job (status "extracting") and publishes one extract_mirror_job
// message; this worker does the actual PDF text-extraction + OCR, resuming
// across invocations via the job's own pageTexts/pagesNeedingOcr staging
// columns (see drizzle/schema.ts's mirrorJobs comment) until every page has
// usable text, then calls finalizeMirrorJobExtraction and hands off to the
// existing generate_mirror_batch workers exactly as upload-and-plan used to
// do inline. Root-cause fix for the 504/FUNCTION_INVOCATION_TIMEOUT bug that
// synchronous OCR inside upload-and-plan could hit on multi-page scans.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request.url);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let jobId: string;
  let job: Awaited<ReturnType<typeof getMirrorJobById>>;
  try {
    const body = JSON.parse(rawBody) as { jobId?: string };
    jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (!jobId) {
      return NextResponse.json({ error: "معرف الملف مفقود." }, { status: 200 });
    }

    job = await getMirrorJobById(jobId);
    if (!job) {
      // Job no longer exists (e.g. deleted mid-extraction) — nothing to do.
      return NextResponse.json({ jobId, status: "skipped" });
    }
    if (job.status !== "extracting") {
      // Already finished by a prior invocation (QStash is at-least-once) —
      // ack without redoing any work.
      return NextResponse.json({ jobId, status: "already_done" });
    }
  } catch (error) {
    console.error("[Mirror] Extraction lookup failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذا الملف." },
      { status: 502 }
    );
  }

  let parser: PDFParse | undefined;
  try {
    const signedGetUrl = await storageGetSignedUrl(job.fileKey);
    parser = new PDFParse({ url: signedGetUrl, CanvasFactory });

    let pages: MirrorPageText[];
    let pagesNeedingOcr: number[];
    let ocrFailedPages: number[];
    let totalPages: number;

    if (!job.pageTexts) {
      // First invocation for this job — run plain text extraction once.
      const result = await parser.getText();
      pages = result.pages.map(page => {
        const text = normalizePageText(page.text);
        return { page: page.num, text, hasText: text.length > 0 };
      });
      totalPages = result.total;

      if (!pages.length) {
        await markMirrorJobExtractionFailed(
          jobId,
          "تعذر قراءة أي صفحة من هذا الملف."
        );
        return NextResponse.json({ jobId, status: "failed" });
      }

      pagesNeedingOcr = pages
        .filter(page => !page.hasText)
        .map(page => page.page);
      ocrFailedPages = [];
      await updateMirrorJobExtractionProgress(jobId, {
        pageCount: totalPages,
        pageTexts: pages,
        pagesNeedingOcr,
        ocrFailedPages,
      });
    } else {
      pages = job.pageTexts;
      pagesNeedingOcr = job.pagesNeedingOcr ?? [];
      ocrFailedPages = job.ocrFailedPages ?? [];
      totalPages = job.pageCount;
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

      await updateMirrorJobExtractionProgress(jobId, {
        pageTexts: pages,
        pagesNeedingOcr: remainingOcr,
        ocrFailedPages,
      });

      if (remainingOcr.length) {
        // More OCR left — publish a continuation for this same job and stop
        // here; the next invocation resumes from the state just saved. A
        // per-job Flow Control key (parallelism 1) keeps invocations for
        // this job strictly sequential even under QStash's at-least-once
        // redelivery, so the shrinking pagesNeedingOcr array is never raced.
        await publishMessage(
          { type: "extract_mirror_job", jobId },
          { flowControl: { key: `mirror-extract-${jobId}`, parallelism: 1 } }
        );
        return NextResponse.json({
          jobId,
          status: "extracting",
          remaining: remainingOcr.length,
        });
      }
    }

    // Every page now has either original or OCR'd text — same completeness
    // checks upload-and-plan used to run synchronously before creating
    // batches.
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
      await markMirrorJobExtractionFailed(
        jobId,
        `لم نتمكن من قراءة كل صفحات الملف. الصفحات التي تحتاج إعادة معالجة: ${pagesToRetry.join(", ")}`
      );
      return NextResponse.json({
        jobId,
        status: "failed",
        pages: pagesToRetry,
      });
    }

    const { batches } = await finalizeMirrorJobExtraction(jobId, pages);

    // Publish one QStash message per generation batch — same handoff
    // upload-and-plan used to do right after creating them inline.
    try {
      await Promise.all(
        batches.map(batch =>
          publishMessage({
            type: "generate_mirror_batch",
            batchId: batch.id,
            jobId,
          })
        )
      );
    } catch (publishError) {
      console.error(
        "[Mirror] Failed to enqueue batches after extraction",
        publishError
      );
      return NextResponse.json(
        { error: "تعذر بدء توليد البطاقات." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      jobId,
      status: "extracted",
      batchCount: batches.length,
    });
  } catch (error) {
    console.error("[Mirror] Extraction failed", error);
    return NextResponse.json(
      { error: "تعذر قراءة الملف أو تجهيزه." },
      { status: 502 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
