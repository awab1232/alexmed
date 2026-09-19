import { getQuestionFileBookById } from "@/lib/db-question-files";
import {
  associateAndSaveQuestionImages,
  ensureQuestionFilePages,
  getNextPendingQuestionFilePage,
  insertExtractedQuestionImage,
  markQuestionFilePageComplete,
  markQuestionFilePageFailed,
} from "@/lib/db-question-file-images";
import {
  buildPageImageClassificationMessages,
  PAGE_IMAGE_CLASSIFICATION_MAX_TOKENS,
  pageImageClassificationResponseSchema,
  parsePageImageClassification,
} from "@/lib/question-file-analysis";
import { invokeLLM, DEFAULT_VISION_MODEL } from "@/lib/llm";
import { claimQuestionFilePage } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import { storageGetSignedUrl, storagePut } from "@/lib/storage";
import { getScreenshotUnderLimit } from "@/lib/pdf-screenshot";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Multimodal question-files pipeline, stage 2 — mirrors
// app/api/books/analyze-page-visuals/route.ts closely: screenshot each page,
// classify it with a cheap vision call, keep only the pages that actually
// contain a real figure. Self-chaining (per-book Flow Control key,
// parallelism 1) exactly like that route, so every page of even a very long
// PDF is eventually processed — never silently stopping after the first
// batch. Once no pending pages remain, runs the deterministic (no-AI)
// image-to-questions association pass and hands off to stage 3.
const PAGES_PER_INVOCATION = 12;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let bookId: string;
  try {
    const body = JSON.parse(rawBody) as { bookId?: string };
    bookId = typeof body.bookId === "string" ? body.bookId : "";
    if (!bookId) {
      return NextResponse.json({ error: "معرف الملف مفقود." }, { status: 200 });
    }
  } catch (error) {
    console.error("[QuestionFiles] Image body parse failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذا الملف." },
      { status: 502 }
    );
  }

  const book = await getQuestionFileBookById(bookId);
  if (!book) {
    return NextResponse.json({ bookId, status: "skipped" });
  }

  // First invocation for this book — creates one question_file_pages row per
  // PDF page (idempotent: only inserts rows that don't already exist), so
  // getNextPendingQuestionFilePage below always has real, claimable rows for
  // every page, same convention as bookPages being created up front.
  await ensureQuestionFilePages(bookId, book.pageCount);

  let parser: PDFParse | undefined;
  try {
    for (let i = 0; i < PAGES_PER_INVOCATION; i++) {
      const candidate = await getNextPendingQuestionFilePage(bookId);
      if (!candidate) break;

      const claimed = await claimQuestionFilePage(candidate.id);
      if (!claimed) continue; // lost the race to another delivery — move on

      try {
        if (!parser) {
          const signedGetUrl = await storageGetSignedUrl(book.fileKey ?? "");
          parser = new PDFParse({ url: signedGetUrl, CanvasFactory });
        }

        const shot = await getScreenshotUnderLimit(
          parser,
          candidate.pageNumber,
          { imageBuffer: true }
        );
        if (!shot?.dataUrl) {
          throw new Error("Page screenshot generation failed");
        }

        const response = await invokeLLM({
          model: DEFAULT_VISION_MODEL,
          max_tokens: PAGE_IMAGE_CLASSIFICATION_MAX_TOKENS,
          messages: buildPageImageClassificationMessages(
            candidate.pageNumber,
            shot.dataUrl
          ),
          response_format: pageImageClassificationResponseSchema,
        });
        const classification = parsePageImageClassification(
          response.choices[0]?.message.content
        );

        if (classification.hasImage && shot.data) {
          const { key: storageKey } = await storagePut(
            `question-files/${bookId}/${candidate.pageNumber}.png`,
            shot.data,
            "image/png"
          );
          await insertExtractedQuestionImage(
            bookId,
            candidate.pageNumber,
            storageKey
          );
        }

        await markQuestionFilePageComplete(candidate.id);
      } catch (pageError) {
        console.error(
          `[QuestionFiles] Page ${candidate.pageNumber} image classification failed`,
          pageError
        );
        await markQuestionFilePageFailed(
          candidate.id,
          "تعذر تحليل صور هذه الصفحة."
        );
      }
    }

    const remaining = await getNextPendingQuestionFilePage(bookId);
    if (remaining) {
      await publishMessage(
        { type: "extract_question_file_images", bookId },
        {
          flowControl: {
            key: `question-file-images-${bookId}`,
            parallelism: 1,
          },
        }
      );
      return NextResponse.json({ bookId, status: "processing" });
    }

    // Every page has reached a terminal status — the pure, no-AI association
    // pass can now run once against the complete picture, then stage 3 takes
    // over per-question AI enrichment.
    await associateAndSaveQuestionImages(bookId);
    await publishMessage({ type: "generate_question_file_content", bookId });
    return NextResponse.json({ bookId, status: "images_done" });
  } catch (error) {
    console.error("[QuestionFiles] Image pipeline failed", error);
    return NextResponse.json(
      { error: "تعذر تحليل صور هذا الملف." },
      { status: 502 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
