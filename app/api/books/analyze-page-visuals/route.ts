import {
  finalizeBookIfDone,
  getBookById,
  getNextPendingBookPage,
  insertBookVisualAssets,
  markBookPageVisualFailed,
  updateBookPageVisualResult,
} from "@/lib/db-books";
import {
  buildPageVisualMessages,
  PAGE_VISUAL_MAX_TOKENS,
  PAGE_VISUAL_MODEL,
  pageVisualResponseSchema,
  parsePageVisualAnalysis,
} from "@/lib/book-page-visual-analysis";
import { invokeLLM } from "@/lib/llm";
import { claimBookPageVisual } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import { storageGetSignedUrl, storagePut } from "@/lib/storage";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts for why.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value — processes at most PAGES_PER_INVOCATION pages (each its own
// screenshot + vision-model call) then self-chains, same OCR_BATCH_SIZE
// convention as app/api/books/extract/route.ts.
export const maxDuration = 60;

const PAGES_PER_INVOCATION = 4;

// كتبي's page-level visual pipeline — runs on EVERY page of every book,
// always (product decision), entirely independent of and never blocking
// text extraction/chapter analysis (see app/api/books/extract/route.ts,
// which publishes the first analyze_book_page_visuals message right after
// finalizeBookExtraction, alongside — not before — the chapter messages).
// Self-chaining: this route claims and processes a few pending pages, then
// republishes itself (per-book Flow Control key, parallelism 1, so the same
// book's pages are never processed by two overlapping invocations) until no
// pending pages remain, then checks whether the whole book can finalize.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request.url);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let bookId: string;
  try {
    const body = JSON.parse(rawBody) as { bookId?: string };
    bookId = typeof body.bookId === "string" ? body.bookId : "";
    if (!bookId) {
      return NextResponse.json(
        { error: "معرف الكتاب مفقود." },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[Books] Page-visual body parse failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذا الكتاب." },
      { status: 502 }
    );
  }

  const book = await getBookById(bookId);
  if (!book) {
    return NextResponse.json({ bookId, status: "skipped" });
  }

  let parser: PDFParse | undefined;
  try {
    for (let i = 0; i < PAGES_PER_INVOCATION; i++) {
      const candidate = await getNextPendingBookPage(bookId);
      if (!candidate) break;

      const claimed = await claimBookPageVisual(candidate.id);
      if (!claimed) continue; // lost the race to another delivery — move on

      try {
        if (!parser) {
          const signedGetUrl = await storageGetSignedUrl(book.fileKey ?? "");
          parser = new PDFParse({ url: signedGetUrl, CanvasFactory });
        }

        const screenshot = await parser.getScreenshot({
          partial: [candidate.pageNumber],
          desiredWidth: 1800,
          imageDataUrl: true,
          imageBuffer: true,
        });
        const shot = screenshot.pages[0];
        if (!shot?.dataUrl || !shot.data) {
          throw new Error("Page screenshot generation failed");
        }

        const { key: storageKey } = await storagePut(
          `book-pages/${bookId}/${candidate.pageNumber}.png`,
          shot.data,
          "image/png"
        );

        const response = await invokeLLM({
          model: PAGE_VISUAL_MODEL,
          max_tokens: PAGE_VISUAL_MAX_TOKENS,
          messages: buildPageVisualMessages(
            candidate.pageNumber,
            candidate.extractedText ?? "",
            shot.dataUrl
          ),
          response_format: pageVisualResponseSchema,
        });
        const analysis = parsePageVisualAnalysis(
          response.choices[0]?.message.content
        );

        const hasImages = analysis.visuals.some(
          v => v.assetType === "image" || v.assetType === "screenshot"
        );
        const hasTables = analysis.visuals.some(v => v.assetType === "table");
        const hasDiagrams = analysis.visuals.some(
          v => v.assetType === "diagram" || v.assetType === "chart"
        );

        await updateBookPageVisualResult(candidate.id, {
          storageKey,
          width: shot.width,
          height: shot.height,
          extractedText: analysis.extractedText || undefined,
          hasImages,
          hasTables,
          hasDiagrams,
          visualStatus: analysis.reviewStatus,
        });

        if (analysis.visuals.length) {
          await insertBookVisualAssets(
            candidate.id,
            bookId,
            candidate.chapterId,
            analysis.visuals.map(v => ({
              assetType: v.assetType,
              storageKey,
              descriptionAr: v.descriptionAr,
              descriptionEn: v.descriptionEn,
              confidence: v.confidence,
              reviewStatus: v.needsReview
                ? ("needs_review" as const)
                : ("complete" as const),
            }))
          );
        }
      } catch (pageError) {
        // One page's failure doesn't fail this whole invocation or the
        // book — it just needs a manual retry (books.retryPageVisual). No
        // automatic QStash-level retry for a single page's error, since
        // this route processes several pages per invocation and always
        // acks (200) once it's done its batch.
        console.error(
          `[Books] Page ${candidate.pageNumber} visual analysis failed`,
          pageError
        );
        await markBookPageVisualFailed(
          candidate.id,
          "تعذر تحليل هذه الصفحة بصريًا."
        );
      }
    }

    const remaining = await getNextPendingBookPage(bookId);
    if (remaining) {
      await publishMessage(
        { type: "analyze_book_page_visuals", bookId },
        { flowControl: { key: `books-visual-${bookId}`, parallelism: 1 } }
      );
      return NextResponse.json({ bookId, status: "processing" });
    }

    await finalizeBookIfDone(bookId);
    return NextResponse.json({ bookId, status: "done" });
  } catch (error) {
    console.error("[Books] Page visual pipeline failed", error);
    return NextResponse.json(
      { error: "تعذر تحليل صفحات هذا الكتاب بصريًا." },
      { status: 502 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
