import {
  BOOK_CHAPTER_MAX_TOKENS,
  SUMMARY_MERGE_MAX_TOKENS,
  bookChapterResponseSchema,
  buildChapterAnalysisMessages,
  buildSummaryMergeMessages,
  chunkChapterPages,
  mergeSubChunkResults,
  parseChapterAnalysis,
  parseSummaryMerge,
  summaryMergeResponseSchema,
  type BookChapterAnalysis,
  type BookPageInput,
} from "@/lib/book-analysis";
import { AiRateLimitError } from "@/lib/ai/types";
import { summaryCoverageFromSections } from "@/lib/chapter-generation";
import {
  buildChapterManifest,
  type SummarySection,
} from "@/lib/document-coverage";
import {
  completeChapterAnalysis,
  finalizeBookIfDone,
  getChapterById,
  markBookChapterFailedTerminal,
  markBookChapterRetrying,
  saveChapterCoverageManifest,
  saveChapterSubChunkProgress,
} from "@/lib/db-books";
import {
  getSafeChapterVisualAssets,
  hasSafePendingChapterVisualAnalysis,
} from "@/lib/chapter-visual-context";
import { invokeLLM } from "@/lib/llm";
import { publishMessage } from "@/lib/queue/client";
import { isUserConcurrencyExceeded } from "@/lib/queue/concurrency";
import { claimBookChapter } from "@/lib/queue/claim";
import { getQueueMaxAttempts } from "@/lib/queue/types";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value. This route can still exceed 60s for chapters split into
// multiple sub-chunks (each sub-chunk is its own sequential AI call) — but
// unlike before the audit fix below, a timeout no longer discards already-
// completed sub-chunks: QStash's retry resumes from chapter.subChunkResults
// instead of redoing (and re-paying for) the whole chapter from sub-chunk 0.
export const maxDuration = 60;

// Fixed re-check interval while waiting on a sibling chapter's page-visual
// analysis to finish — deliberately NOT exponential backoff (unlike
// extract/route.ts's OCR retries, which back off because failures there are
// often transient provider errors worth spacing out): this isn't a failure
// at all, just "not ready yet", so a steady poll is the right shape.
const WAITING_FOR_VISUALS_RETRY_DELAY_SECONDS = 30;
// Same steady re-check while the student's other chapters hold every
// per-user slot (QUEUE_PER_USER_CONCURRENCY).
const WAITING_FOR_SLOT_RETRY_DELAY_SECONDS = 20;

// Backoff for a failed attempt that still has budget left — the same
// 10s/30s/90s shape as QStash's own schedule (lib/queue/client.ts), but
// published by the worker itself so the retry can't be lost (see
// scheduleRetry below).
function retryDelaySeconds(attemptCount: number) {
  return Math.min(10 * 3 ** Math.max(0, attemptCount - 1), 300);
}

// The كتبي worker (QStash queue migration): analyzes exactly ONE chapter
// (internally sub-chunked if it's long, resumably — see subChunkResults),
// persisting each sub-chunk's result as it completes and the full merged
// result once every sub-chunk is done. This route is no longer callable by
// the browser — it's invoked only by QStash, verified via signature below —
// see app/books/[bookId]/page.tsx, which now just polls chapter status
// instead of driving analysis itself.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let chapterId: string;
  let chapter: Awaited<ReturnType<typeof getChapterById>>;
  let claimed: Awaited<ReturnType<typeof claimBookChapter>>;
  try {
    const body = JSON.parse(rawBody) as { chapterId?: string };
    chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
    if (!chapterId) {
      return NextResponse.json({ error: "معرف الفصل مفقود." }, { status: 200 });
    }

    chapter = await getChapterById(chapterId);
    if (!chapter) {
      return NextResponse.json({ chapterId, status: "skipped" });
    }

    // Checked BEFORE claiming, and deliberately NOT going through
    // claim/attemptCount at all: page-visual analysis (a sibling pipeline,
    // self-chaining at its own pace — see analyze-page-visuals/route.ts) can
    // legitimately take far longer than QStash's own retry budget
    // (QUEUE_MAX_ATTEMPTS deliveries, ~10s+30s+90s ≈ 2 minutes total) allows
    // for a real multi-page book. Returning 429 here used to spend that same
    // shared budget on "still waiting" cycles — once QStash gave up after
    // ~2 minutes, the chapter was stuck in "retrying" FOREVER even after
    // visuals finished seconds/minutes later, since nothing ever re-checked
    // it again. Self-publishing our own delayed retry (and returning 200,
    // not a failure) decouples "healthy chapter patiently waiting on a
    // sibling job" from the genuine-failure attemptCount budget below, and
    // is provably bounded: hasPendingChapterVisualAnalysis only counts
    // pending/processing pages, and every page's own visual pipeline
    // terminates (complete or permanently failed) within its own bounded
    // retry budget — so this can never wait forever.
    if (await hasSafePendingChapterVisualAnalysis(chapterId)) {
      await markBookChapterRetrying(
        chapterId,
        "ننتظر اكتمال قراءة صور وجداول هذا الفصل قبل بناء الملخص."
      );
      await publishMessage(
        { type: "analyze_book_chapter", chapterId, bookId: chapter.bookId },
        { delay: WAITING_FOR_VISUALS_RETRY_DELAY_SECONDS }
      );
      return NextResponse.json({ chapterId, status: "waiting_for_visuals" });
    }

    // Per-user concurrency backstop, checked BEFORE claiming — so one
    // student's book can't monopolize capacity. The row stays claimable
    // (nothing mutated), QStash redelivers later per its own backoff.
    // Self-scheduled like the visuals wait above, NOT a 429: QStash's
    // redelivery budget (~2 minutes) is shorter than a sibling chapter's
    // run, so relying on it left later chapters "pending" forever with no
    // message left to ever pick them up.
    if (await isUserConcurrencyExceeded(chapter.userId, "books")) {
      await publishMessage(
        { type: "analyze_book_chapter", chapterId, bookId: chapter.bookId },
        { delay: WAITING_FOR_SLOT_RETRY_DELAY_SECONDS }
      );
      return NextResponse.json({ chapterId, status: "throttled" });
    }

    claimed = await claimBookChapter(chapterId);
    if (!claimed) {
      // Already processing/complete — QStash is at-least-once, this is
      // expected occasionally, not an error.
      return NextResponse.json({ chapterId, status: "already_processing" });
    }
  } catch (error) {
    // Anything before the claim (malformed body, a transient DB error) is
    // safe to let QStash retry — nothing has been claimed/mutated yet.
    console.error("[Books] Chapter lookup/claim failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذا الفصل." },
      { status: 502 }
    );
  }

  const pages = (chapter.pageTexts ?? []) as BookPageInput[];
  const maxAttempts = getQueueMaxAttempts();

  async function retryOrFail(errorMessage: string, httpStatus: number) {
    if (claimed!.attemptCount >= maxAttempts) {
      await markBookChapterFailedTerminal(chapterId, errorMessage);
      await finalizeBookIfDone(chapter!.bookId);
      return NextResponse.json({
        chapterId,
        status: "failed",
        error: errorMessage,
      });
    }
    await markBookChapterRetrying(chapterId, errorMessage);
    // The worker schedules its own next attempt instead of answering with
    // an error for QStash to retry: QStash's delivery budget is also spent
    // by throttled/duplicate deliveries, and a long run can outlive the
    // HTTP connection QStash is waiting on — either way the chapter was
    // left "retrying" with nothing queued to ever run it again. Only if
    // this publish itself fails do we fall back to QStash's retry.
    try {
      await publishMessage(
        { type: "analyze_book_chapter", chapterId, bookId: chapter!.bookId },
        { delay: retryDelaySeconds(claimed!.attemptCount) }
      );
      return NextResponse.json({
        chapterId,
        status: "retry_scheduled",
        error: errorMessage,
      });
    } catch (publishError) {
      console.error("[Books] Failed to schedule chapter retry", publishError);
      return NextResponse.json({ error: errorMessage }, { status: httpStatus });
    }
  }

  if (!pages.length) {
    return await retryOrFail("لا يوجد نص مستخرج لهذا الفصل.", 422);
  }

  const visualAssets = await getSafeChapterVisualAssets(chapterId);
  const visualByPage = new Map<number, typeof visualAssets>();
  for (const asset of visualAssets) {
    const pageAssets = visualByPage.get(asset.pageNumber) ?? [];
    pageAssets.push(asset);
    visualByPage.set(asset.pageNumber, pageAssets);
  }
  const pagesWithVisualContext = pages.map(page => {
    const assets = visualByPage.get(page.page) ?? [];
    if (!assets.length) return page;
    const visualContext = assets
      .map(
        asset =>
          `[VISUAL ${asset.assetType} — page ${asset.pageNumber}]\nEnglish: ${asset.descriptionEn}\nArabic: ${asset.descriptionAr}`
      )
      .join("\n");
    return { ...page, text: `${page.text}\n\n${visualContext}` };
  });

  try {
    // chunkChapterPages is a pure function of chapter.pageTexts, which never
    // changes after extraction — so this produces the exact same sub-chunk
    // boundaries on every invocation/retry, making it safe to resume from
    // wherever chapter.subChunkResults last left off.
    const subChunks = chunkChapterPages(pagesWithVisualContext);
    const subChunkResults: BookChapterAnalysis[] = [
      ...(chapter.subChunkResults ?? []),
    ];
    for (let i = subChunkResults.length; i < subChunks.length; i++) {
      const response = await invokeLLM({
        max_tokens: BOOK_CHAPTER_MAX_TOKENS,
        messages: buildChapterAnalysisMessages(
          chapter.title,
          subChunks[i],
          chapter.bookProfile
        ),
        response_format: bookChapterResponseSchema,
      });
      subChunkResults.push(
        parseChapterAnalysis(response.choices[0]?.message.content)
      );
      // Persisted immediately (P0 audit fix) — a timeout or failure on the
      // NEXT sub-chunk must never re-do (or re-pay for) this one.
      await saveChapterSubChunkProgress(chapterId, subChunkResults);
    }

    const merged = mergeSubChunkResults(subChunkResults);

    // Reject (not coerce) any card/MCQ whose sourcePage falls outside this
    // chapter's own page range — same data-integrity guard مِرآة (generate-
    // batch) and مكتبة الأدمن already have; كتبي never had it until now.
    const flashcards = merged.flashcards.filter(
      card =>
        card.sourcePage >= chapter.startPage &&
        card.sourcePage <= chapter.endPage
    );
    const mcqs = merged.mcqs.filter(
      mcq =>
        mcq.sourcePage >= chapter.startPage && mcq.sourcePage <= chapter.endPage
    );

    // Hierarchical summary with provable coverage: one summary per
    // sub-chunk (each tagged with its real page range), ALL of them fed to
    // the global merge — never just the first. The per-part sections are
    // also kept in the manifest (summarySections) as sourced summary
    // sections.
    const summarySections: SummarySection[] = subChunks.map((chunk, i) => ({
      chunkId: `chunk-${i + 1}`,
      pageStart: Math.min(...chunk.map(page => page.page)),
      pageEnd: Math.max(...chunk.map(page => page.page)),
      summary: subChunkResults[i]?.chapterSummary ?? "",
    }));
    if (subChunkResults.length !== subChunks.length) {
      throw new Error(
        `Only ${subChunkResults.length}/${subChunks.length} sub-chunks were analyzed.`
      );
    }

    let chapterSummary = merged.summaries[0] ?? "";
    if (merged.summaries.length > 1) {
      const summaryResponse = await invokeLLM({
        max_tokens: SUMMARY_MERGE_MAX_TOKENS,
        messages: buildSummaryMergeMessages(
          merged.summaries,
          merged.keyPoints,
          summarySections
        ),
        response_format: summaryMergeResponseSchema,
      });
      chapterSummary = parseSummaryMerge(
        summaryResponse.choices[0]?.message.content
      ).chapterSummary;
    }

    await completeChapterAnalysis(chapterId, chapter.userId, {
      explanationAr: merged.explanationAr,
      explanationEn: merged.explanationEn,
      keyPoints: merged.keyPoints,
      chapterSummary,
      terms: merged.medicalTerms,
      cards: flashcards,
      mcqs,
    });
    // Manifest + summary Quality Gate. Recorded, never blocking: the
    // chapter's content is saved either way, but a PARTIAL/FAILED verdict is
    // stored and shown instead of claiming a complete summary.
    try {
      const summaryCoverage = summaryCoverageFromSections(
        pages,
        summarySections
      );
      await saveChapterCoverageManifest(
        chapterId,
        buildChapterManifest(pages, chapter.coverageManifest ?? null, {
          chunksAnalyzed: subChunkResults.length,
          summarySections,
          output: summaryCoverage,
        })
      );
    } catch (manifestError) {
      console.error("[Books] Failed to save coverage manifest", manifestError);
    }

    await finalizeBookIfDone(chapter.bookId);

    // Audit Phase 6 — kicks off the chapter's hierarchical mind-map
    // sections now that there's real content to build them from. Entirely
    // independent of everything above (never blocks/delays this response,
    // and never re-attempts this same chapter's analysis if it fails) — a
    // failure here is logged but doesn't fail this route: the chapter is
    // already durably complete, and the reader's own "بناء الخريطة
    // الهرمية" button remains available as a fallback.
    try {
      await publishMessage({
        type: "generate_chapter_mindmap_sections",
        chapterId,
      });
    } catch (publishError) {
      console.error(
        "[Books] Failed to enqueue mind-map section generation",
        publishError
      );
    }

    return NextResponse.json({ chapterId, status: "complete" });
  } catch (error) {
    console.error("[Books] Chapter analysis failed", error);
    if (error instanceof AiRateLimitError) {
      return await retryOrFail(
        "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي.",
        429
      );
    }
    return await retryOrFail("تعذر تحليل هذا الفصل.", 502);
  }
}
