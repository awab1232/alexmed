import { auth } from "@/lib/auth";
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
  type BookPageInput,
} from "@/lib/book-analysis";
import { AiRateLimitError } from "@/lib/ai/types";
import {
  completeChapterAnalysis,
  getChapterForUser,
  setChapterAnalyzing,
  setChapterFailed,
} from "@/lib/db-books";
import { invokeLLM } from "@/lib/llm";
import { NextResponse } from "next/server";

// The core of the resumable book pipeline: analyzes exactly ONE chapter
// (internally sub-chunked if it's long) and persists the full result before
// returning. The client calls this once per pending chapter, sequentially —
// see the plan's "Resumability without a queue" for why this is what makes
// leaving and returning mid-book safe with no background worker.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    chapterId?: string;
  };
  const chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
  if (!chapterId) {
    return NextResponse.json({ error: "معرف الفصل مفقود." }, { status: 400 });
  }

  const chapter = await getChapterForUser(session.user.id, chapterId);
  if (!chapter) {
    return NextResponse.json({ error: "الفصل غير موجود." }, { status: 404 });
  }

  const pages = (chapter.pageTexts ?? []) as BookPageInput[];
  if (!pages.length) {
    await setChapterFailed(chapterId, "لا يوجد نص مستخرج لهذا الفصل.");
    return NextResponse.json(
      { error: "لا يوجد نص مستخرج لهذا الفصل." },
      { status: 422 }
    );
  }

  await setChapterAnalyzing(chapterId);

  try {
    const subChunks = chunkChapterPages(pages);
    const subChunkResults = [];
    for (const chunk of subChunks) {
      const response = await invokeLLM({
        max_tokens: BOOK_CHAPTER_MAX_TOKENS,
        messages: buildChapterAnalysisMessages(chapter.title, chunk),
        response_format: bookChapterResponseSchema,
      });
      subChunkResults.push(
        parseChapterAnalysis(response.choices[0]?.message.content)
      );
    }

    const merged = mergeSubChunkResults(subChunkResults);

    let chapterSummary = merged.summaries[0] ?? "";
    if (merged.summaries.length > 1) {
      const summaryResponse = await invokeLLM({
        max_tokens: SUMMARY_MERGE_MAX_TOKENS,
        messages: buildSummaryMergeMessages(merged.summaries, merged.keyPoints),
        response_format: summaryMergeResponseSchema,
      });
      chapterSummary = parseSummaryMerge(
        summaryResponse.choices[0]?.message.content
      ).chapterSummary;
    }

    await completeChapterAnalysis(chapterId, session.user.id, {
      explanationAr: merged.explanationAr,
      explanationEn: merged.explanationEn,
      keyPoints: merged.keyPoints,
      chapterSummary,
      terms: merged.medicalTerms,
      cards: merged.flashcards,
      mcqs: merged.mcqs,
    });

    return NextResponse.json({ chapterId, status: "complete" });
  } catch (error) {
    console.error("[Books] Chapter analysis failed", error);
    if (error instanceof AiRateLimitError) {
      await setChapterFailed(
        chapterId,
        "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي."
      );
      return NextResponse.json(
        {
          error:
            "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي. سيُعاد المحاولة تلقائيًا بعد قليل.",
          retryAfterMs: error.retryAfterMs,
        },
        { status: 429 }
      );
    }
    await setChapterFailed(chapterId, "تعذر تحليل هذا الفصل.");
    return NextResponse.json(
      { error: "تعذر تحليل هذا الفصل. حاول مرة أخرى." },
      { status: 502 }
    );
  }
}
