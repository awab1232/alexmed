// LIVE version of lib/full-document-coverage.test.ts: the same 40-page PDF
// through the production pipeline code with the REAL model (invokeLLM via
// the configured OmniRoute/OpenRouter gateway). Skipped unless LIVE_AI=1 —
// it spends real AI credits (~30 calls). Never touches the database: it
// runs the pure pipeline functions the workers use, in the same order the
// workers run them:
//   extract (pdf-parse) → detectChapters → per chapter: analysis per
//   sub-chunk + global summary merge → chunked flashcards / MCQs → mind map
//   → Quality Gate on every output.
//
//   LIVE_AI=1 npx vitest run lib/full-document-coverage.live.test.ts
import { config as loadEnv } from "dotenv";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { normalizePageText } from "./pdf-cards";
import { detectChapters } from "./book-chapters";
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
} from "./book-analysis";
import {
  validateExtractionCoverage,
  type OutputCoverage,
  type SummarySection,
} from "./document-coverage";
import {
  generateChapterFlashcardsCovered,
  generateChapterMcqsCovered,
  generateChapterMindMapCovered,
  summaryCoverageFromSections,
} from "./chapter-generation";
import {
  buildFortyPageMedicalPdf,
  LATE_PAGE_FACTS,
} from "./test-fixtures/forty-page-medical-pdf";

const live = process.env.LIVE_AI === "1";
if (live) loadEnv();

const LATE_PAGES = [35, 36, 37, 39, 40];

function mentions(text: string, page: number): boolean {
  return text
    .toLowerCase()
    .includes(LATE_PAGE_FACTS[page].keyword.toLowerCase());
}

describe.skipIf(!live)("LIVE full-document coverage — 40-page PDF", () => {
  it(
    "the real model studies all 40 pages, provably",
    async () => {
      const { invokeLLM } = await import("./llm");

      // 1. Extraction
      const parser = new PDFParse({ data: buildFortyPageMedicalPdf() });
      const parsed = await parser.getText();
      await parser.destroy();
      const pages: BookPageInput[] = parsed.pages.map(page => ({
        page: page.num,
        text: normalizePageText(page.text),
      }));
      const extraction = validateExtractionCoverage(parsed.total, pages);
      expect(extraction.status).toBe("COMPLETE");

      // 2. Chapters exactly as finalizeBookExtraction splits them
      const detected = detectChapters(pages);
      const method = detected.method;
      // LIVE_FROM_PAGE=33 re-runs only the chapters from that page on (e.g.
      // after a network drop mid-run) — the late-page facts all live there.
      const fromPage = Number(process.env.LIVE_FROM_PAGE ?? 1);
      const chapters = detected.chapters.filter(c => c.endPage >= fromPage);

      const report: Record<string, unknown>[] = [];
      const all = {
        summaries: [] as string[],
        explanations: [] as string[],
        cards: [] as {
          questionEn: string;
          answerEn: string;
          sourcePage: number;
        }[],
        mcqs: [] as {
          questionEn: string;
          explanationEn: string;
          sourcePage: number;
        }[],
        mindMap: [] as {
          title: string;
          summaryEn: string;
          sourcePages: number[];
          examPoints: string[];
        }[],
        coverage: [] as OutputCoverage[],
      };

      for (const chapter of chapters) {
        const chapterPages = pages.filter(
          p => p.page >= chapter.startPage && p.page <= chapter.endPage
        );

        // 3. Analysis per sub-chunk + global merge (analyze-chapter route)
        const subChunks = chunkChapterPages(chapterPages);
        const results = [];
        for (const chunk of subChunks) {
          // The worker is redelivered by QStash when a response is
          // malformed; mirror that with up to 3 attempts here.
          for (let attempt = 1; ; attempt++) {
            try {
              const response = await invokeLLM({
                max_tokens: BOOK_CHAPTER_MAX_TOKENS,
                messages: buildChapterAnalysisMessages(chapter.title, chunk),
                response_format: bookChapterResponseSchema,
              });
              results.push(
                parseChapterAnalysis(response.choices[0]?.message.content)
              );
              break;
            } catch (error) {
              if (attempt >= 3) throw error;
            }
          }
        }
        const merged = mergeSubChunkResults(results);
        const sections: SummarySection[] = subChunks.map((chunk, i) => ({
          chunkId: `chunk-${i + 1}`,
          pageStart: Math.min(...chunk.map(p => p.page)),
          pageEnd: Math.max(...chunk.map(p => p.page)),
          summary: results[i]?.chapterSummary ?? "",
        }));
        let chapterSummary = merged.summaries[0] ?? "";
        if (merged.summaries.length > 1) {
          const summaryResponse = await invokeLLM({
            max_tokens: SUMMARY_MERGE_MAX_TOKENS,
            messages: buildSummaryMergeMessages(
              merged.summaries,
              merged.keyPoints,
              sections
            ),
            response_format: summaryMergeResponseSchema,
          });
          chapterSummary = parseSummaryMerge(
            summaryResponse.choices[0]?.message.content
          ).chapterSummary;
        }
        const summaryCoverage = summaryCoverageFromSections(
          chapterPages,
          sections
        );

        // 4. Chunked generators (book-enrichment)
        const cards = await generateChapterFlashcardsCovered(
          chapter.title,
          chapterPages,
          invokeLLM
        );
        const mcqs = await generateChapterMcqsCovered(
          chapter.title,
          chapterPages,
          invokeLLM
        );
        // Mind map: a failure is recorded (with what the model actually
        // answered) instead of aborting the whole run — in production it's
        // a separate worker and never blocks the chapter either.
        const mindMapProbe: { promptChars: number; answer: string }[] = [];
        const probingLlm: typeof invokeLLM = async params => {
          const promptChars = params.messages
            .map(m => (typeof m.content === "string" ? m.content.length : 0))
            .reduce((a, b) => a + b, 0);
          try {
            const response = await invokeLLM(params);
            mindMapProbe.push({
              promptChars,
              answer: (response.choices[0]?.message.content ?? "").slice(
                0,
                600
              ),
            });
            return response;
          } catch (error) {
            mindMapProbe.push({
              promptChars,
              answer: `THREW: ${(error as Error).message}`,
            });
            throw error;
          }
        };
        let mindMap: Awaited<ReturnType<typeof generateChapterMindMapCovered>>;
        try {
          mindMap = await generateChapterMindMapCovered(
            {
              title: chapter.title,
              explanationEn: merged.explanationEn,
              explanationAr: merged.explanationAr,
              keyPoints: merged.keyPoints,
              terms: merged.medicalTerms,
              flashcards: cards.items,
              mcqs: mcqs.items,
              validPages: chapterPages.map(p => p.page),
              summarySections: sections,
            },
            chapterPages,
            probingLlm
          );
        } catch (error) {
          mindMap = {
            items: [],
            coverage: {
              kind: "mindmap",
              itemCount: 0,
              totalChunks: 1,
              requiredChunks: ["chunk-1"],
              coveredChunks: [],
              uncoveredChunks: ["chunk-1"],
              coveredPages: [],
              chunkCoveragePercent: 0,
              status: "FAILED",
              reasons: [(error as Error).message],
            },
            chunks: [],
            pageTypes: {},
            errors: [(error as Error).message],
          };
        }
        if (process.env.LIVE_REPORT_PATH) {
          writeFileSync(
            `${process.env.LIVE_REPORT_PATH}.mindmap-${chapter.startPage}.json`,
            JSON.stringify(mindMapProbe, null, 2)
          );
        }

        all.summaries.push(chapterSummary);
        all.explanations.push(merged.explanationEn, ...merged.keyPoints);
        all.cards.push(...cards.items);
        all.mcqs.push(...mcqs.items);
        all.mindMap.push(...mindMap.items);
        all.coverage.push(
          summaryCoverage,
          cards.coverage,
          mcqs.coverage,
          mindMap.coverage
        );
        report.push({
          chapter: `${chapter.title} (${chapter.startPage}–${chapter.endPage})`,
          subChunks: subChunks.length,
          summary: chapterSummary,
          coverage: {
            summary: summaryCoverage.status,
            flashcards: `${cards.coverage.status} ${cards.coverage.coveredChunks.length}/${cards.coverage.requiredChunks.length}`,
            mcqs: `${mcqs.coverage.status} ${mcqs.coverage.coveredChunks.length}/${mcqs.coverage.requiredChunks.length}`,
            mindmap: `${mindMap.coverage.status} ${mindMap.coverage.coveredChunks.length}/${mindMap.coverage.requiredChunks.length}`,
          },
          flashcardPages: cards.items.map(c => c.sourcePage),
          mcqPages: mcqs.items.map(m => m.sourcePage),
          mindMapPages: mindMap.items.map(s => s.sourcePages),
          errors: [...cards.errors, ...mcqs.errors, ...mindMap.errors],
        });
      }

      // 5. Evidence per late page
      const evidence = LATE_PAGES.map(page => ({
        page,
        keyword: LATE_PAGE_FACTS[page].keyword,
        inSummary:
          all.summaries.some(s => mentions(s, page)) ||
          all.explanations.some(s => mentions(s, page)),
        flashcards: all.cards
          .filter(c => c.sourcePage === page)
          .map(c => `${c.questionEn} → ${c.answerEn}`),
        mcqs: all.mcqs
          .filter(m => m.sourcePage === page)
          .map(m => m.questionEn),
        mindMapNodes: all.mindMap
          .filter(s => s.sourcePages.includes(page))
          .map(s => s.title),
      }));

      const out = {
        extraction,
        chapterMethod: method,
        chapters: chapters.map(c => `${c.title}: ${c.startPage}–${c.endPage}`),
        totals: {
          flashcards: all.cards.length,
          mcqs: all.mcqs.length,
          mindMapSections: all.mindMap.length,
          flashcardsFromPages1to3: all.cards.filter(c => c.sourcePage <= 3)
            .length,
          mcqsFromPages1to3: all.mcqs.filter(m => m.sourcePage <= 3).length,
          flashcardsFromPages30to40: all.cards.filter(c => c.sourcePage >= 30)
            .length,
          mcqsFromPages30to40: all.mcqs.filter(m => m.sourcePage >= 30).length,
        },
        evidence,
        report,
      };
      if (process.env.LIVE_REPORT_PATH) {
        writeFileSync(
          process.env.LIVE_REPORT_PATH,
          JSON.stringify(out, null, 2)
        );
      }
      console.log(JSON.stringify({ totals: out.totals, evidence }, null, 2));

      // 6. The acceptance criteria
      for (const coverage of all.coverage) {
        expect(
          coverage.status,
          `${coverage.kind}: ${coverage.reasons.join(" ")}`
        ).not.toBe("FAILED");
      }
      for (const item of evidence) {
        expect(item.inSummary, `summary mentions page ${item.page}`).toBe(true);
        expect(
          item.mindMapNodes.length,
          `mind map node for page ${item.page}`
        ).toBeGreaterThan(0);
      }
      // Questions/cards from the late pages (each late fact is its own dense
      // page; allow the model to skip at most one of the five).
      expect(
        evidence.filter(e => e.flashcards.length).length
      ).toBeGreaterThanOrEqual(4);
      expect(evidence.filter(e => e.mcqs.length).length).toBeGreaterThanOrEqual(
        4
      );
      expect(all.cards.filter(c => c.sourcePage >= 30).length).toBeGreaterThan(
        all.cards.filter(c => c.sourcePage <= 3).length
      );
    },
    Number(process.env.LIVE_TIMEOUT_MS ?? 60 * 60 * 1000)
  );
});
