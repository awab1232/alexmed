// 40-page regression test for the "AI studies the first pages, not the
// document" bug. Runs the REAL pipeline code end to end — real PDF bytes,
// real pdf-parse extraction, real chapter detection, real chunking, the
// real chunked generators and Quality Gate — with a deterministic
// "echo" model standing in for the LLM: it can only produce items from
// the page text actually sent to it, so every assertion about late pages
// proves those pages really reached generation.
//
// The live-model version of this same scenario is
// lib/full-document-coverage.live.test.ts (LIVE_AI=1).
import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { normalizePageText } from "./pdf-cards";
import { detectChapters } from "./book-chapters";
import {
  buildChapterAnalysisMessages,
  buildSummaryMergeMessages,
  chunkChapterPages,
  type BookPageInput,
} from "./book-analysis";
import {
  buildDocumentChunks,
  classifyPages,
  validateChunkCoverage,
  validateExtractionCoverage,
  validateOutputCoverage,
  type SummarySection,
} from "./document-coverage";
import {
  generateChapterFlashcardsCovered,
  generateChapterMcqsCovered,
  generateChapterMindMapCovered,
  generateChapterNotesCovered,
  summaryCoverageFromSections,
  type Llm,
} from "./chapter-generation";
import { buildBookProcessingManifest } from "./db-books";
import {
  buildFortyPageMedicalPdf,
  LATE_PAGE_FACTS,
} from "./test-fixtures/forty-page-medical-pdf";
import type { InvokeParams } from "./llm";

const LATE_PAGES = [35, 36, 37, 39, 40];

async function extractPages(): Promise<{
  total: number;
  pages: BookPageInput[];
}> {
  const parser = new PDFParse({ data: buildFortyPageMedicalPdf() });
  try {
    const result = await parser.getText();
    return {
      total: result.total,
      pages: result.pages.map(page => ({
        page: page.num,
        text: normalizePageText(page.text),
      })),
    };
  } finally {
    await parser.destroy();
  }
}

// ── Echo model ────────────────────────────────────────────────────────────
function userText(params: InvokeParams): string {
  return params.messages
    .filter(message => message.role === "user")
    .map(message =>
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content)
    )
    .join("\n");
}

function pagesFromPrompt(text: string): { page: number; text: string }[] {
  const pages: { page: number; text: string }[] = [];
  const re =
    /(?:===== PDF PAGE (\d+)[^=\n]*=====|\[PAGE (\d+)\])\n([\s\S]*?)(?=\n?(?:===== PDF PAGE|\[PAGE \d+\])|$)/g;
  for (const match of text.matchAll(re)) {
    pages.push({
      page: Number(match[1] ?? match[2]),
      text: match[3].trim(),
    });
  }
  return pages;
}

// The one sentence an honest model would extract from a page: its key exam
// fact when it has one, else its first sentence.
function keySentence(rawText: string): string {
  // Extracted PDF text keeps the page's visual line breaks.
  const text = rawText.replace(/\s+/g, " ").trim();
  const fact = text.match(/Key exam fact: (.*?\.)(\s|$)/);
  if (fact) return fact[1];
  return (text.match(/^[^.]*\./)?.[0] ?? text).trim();
}

type EchoOptions = {
  // Simulates the original bug: the model only uses pages ≤ this number.
  onlyUpToPage?: number;
};

function echoModel(options: EchoOptions = {}, calls: InvokeParams[] = []): Llm {
  return async params => {
    calls.push(params);
    const schema = (
      params.response_format as { json_schema?: { name?: string } }
    )?.json_schema?.name;
    const text = userText(params);
    const pages = pagesFromPrompt(text).filter(
      page => !options.onlyUpToPage || page.page <= options.onlyUpToPage
    );
    let body: unknown;
    switch (schema) {
      case "chapter_flashcards":
        body = {
          flashcards: pages.map(page => ({
            questionEn: `What is the key point of page ${page.page}? ${keySentence(page.text)}`,
            questionAr: "سؤال",
            answerEn: keySentence(page.text),
            answerAr: "جواب",
            relatedTermEn: "",
            sourcePage: page.page,
          })),
        };
        break;
      case "chapter_mcqs":
        body = {
          mcqs: pages.map(page => ({
            questionEn: `Which statement is true (page ${page.page})? ${keySentence(page.text)}`,
            choices: [keySentence(page.text), "B", "C", "D"],
            correctIndex: 0,
            explanationEn: keySentence(page.text),
            sourcePage: page.page,
          })),
        };
        break;
      case "book_chapter_analysis": {
        const facts = pages.map(page => keySentence(page.text)).join(" ");
        body = {
          explanationAr: "شرح",
          explanationEn: facts,
          keyPoints: pages.map(page => keySentence(page.text)),
          medicalTerms: [],
          flashcards: [],
          mcqs: [],
          chapterSummary: facts,
        };
        break;
      }
      case "chapter_summary_merge":
        body = {
          chapterSummary: [...text.matchAll(/\(\d+, pages [^)]*\) ([^\n]*)/g)]
            .map(match => match[1])
            .join(" "),
        };
        break;
      case "chapter_mind_map_sections":
        body = {
          sections: [
            ...text.matchAll(/Part \d+ \(pages (\d+)–(\d+)\): ([^\n]*)/g),
          ]
            .filter(
              match =>
                !options.onlyUpToPage ||
                Number(match[1]) <= options.onlyUpToPage
            )
            .map(match => ({
              title: `Pages ${match[1]}–${match[2]}`,
              summaryEn: match[3],
              explanationAr: "",
              sourcePages: Array.from(
                { length: Number(match[2]) - Number(match[1]) + 1 },
                (_, i) => Number(match[1]) + i
              ),
              concepts: [],
              examPoints: [match[3]],
              cardPrompts: [],
            })),
        };
        break;
      case "medical_note_composer_pages":
        body = {
          pages: pages.length
            ? [
                {
                  title: `Notes ${pages[0].page}–${pages[pages.length - 1].page}`,
                  subtitle: "",
                  layout: "sections",
                  sourcePages: pages.map(page => page.page),
                  blocks: pages.map(page => ({
                    kind: "definition",
                    heading: `Page ${page.page}`,
                    bodyEn: keySentence(page.text),
                    bodyAr: "",
                    items: [],
                    tone: "default",
                    sourcePages: [page.page],
                  })),
                },
              ]
            : [],
        };
        break;
      default:
        throw new Error(`echo model: unexpected schema ${schema}`);
    }
    return {
      id: "echo",
      created: 0,
      model: "echo",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify(body) },
          finish_reason: "stop",
        },
      ],
    };
  };
}

// Mirrors app/api/books/analyze-chapter/route.ts: one analysis per
// sub-chunk, then the global merge over ALL sub-chunk summaries.
async function analyzeChapter(pages: BookPageInput[], llm: Llm) {
  const subChunks = chunkChapterPages(pages);
  const results = [];
  for (const chunk of subChunks) {
    const response = await llm({
      messages: buildChapterAnalysisMessages("Whole lecture", chunk),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "book_chapter_analysis",
          strict: true,
          schema: {},
        },
      },
    });
    results.push(JSON.parse(response.choices[0].message.content));
  }
  const sections: SummarySection[] = subChunks.map((chunk, i) => ({
    chunkId: `chunk-${i + 1}`,
    pageStart: Math.min(...chunk.map(p => p.page)),
    pageEnd: Math.max(...chunk.map(p => p.page)),
    summary: results[i].chapterSummary,
  }));
  const merged = await llm({
    messages: buildSummaryMergeMessages(
      results.map(r => r.chapterSummary),
      [],
      sections
    ),
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "chapter_summary_merge",
        strict: true,
        schema: {},
      },
    },
  });
  return {
    sections,
    explanationEn: results.map(r => r.explanationEn).join("\n\n"),
    chapterSummary: JSON.parse(merged.choices[0].message.content)
      .chapterSummary as string,
  };
}

describe("full-document coverage — 40-page PDF (pages 1–3 metadata)", () => {
  it("PHASE 1: extracts every page of the real PDF", async () => {
    const { total, pages } = await extractPages();
    expect(total).toBe(40);
    const extraction = validateExtractionCoverage(total, pages);
    expect(extraction).toMatchObject({
      totalPages: 40,
      extractedPages: 40,
      missingPages: [],
      failedPages: [],
      coveragePercent: 100,
      status: "COMPLETE",
    });
    for (const [page, { keyword }] of Object.entries(LATE_PAGE_FACTS)) {
      expect(pages.find(p => p.page === Number(page))?.text).toContain(keyword);
    }
  });

  it("classifies pages 1–3 as metadata without dropping them", async () => {
    const { pages } = await extractPages();
    const types = classifyPages(pages);
    expect([types[1], types[2], types[3]]).toEqual([
      "metadata",
      "metadata",
      "metadata",
    ]);
    for (let page = 4; page <= 40; page++) {
      expect(types[page]).not.toBe("metadata");
    }
    // Labels only: metadata pages still go into chunks.
    const { chunks } = buildDocumentChunks(pages);
    expect(chunks[0].pages).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it("PHASE 2: every page lands in a chunk, and chapters span 1–40", async () => {
    const { pages } = await extractPages();
    const { chunks } = buildDocumentChunks(pages);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(validateChunkCoverage(pages, chunks)).toEqual({
      missingPages: [],
      complete: true,
    });
    expect(chunks.flatMap(chunk => chunk.pages).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1)
    );
    expect(chunks[chunks.length - 1].pages).toContain(40);

    const { chapters } = detectChapters(pages);
    const covered = new Set(
      chapters.flatMap(chapter =>
        Array.from(
          { length: chapter.endPage - chapter.startPage + 1 },
          (_, i) => chapter.startPage + i
        )
      )
    );
    expect(covered.size).toBe(40);
  });

  it("PHASE 4: summary, flashcards, MCQs, notes and mind map all carry late-page content", async () => {
    const { pages } = await extractPages();
    const calls: InvokeParams[] = [];
    const llm = echoModel({}, calls);

    // Summary (hierarchical: per sub-chunk → global merge)
    const analysis = await analyzeChapter(pages, llm);
    const summaryCoverage = summaryCoverageFromSections(
      pages,
      analysis.sections
    );
    expect(summaryCoverage.status).toBe("COMPLETE");
    for (const page of LATE_PAGES) {
      expect(analysis.chapterSummary).toContain(LATE_PAGE_FACTS[page].keyword);
    }

    const cards = await generateChapterFlashcardsCovered("Lecture", pages, llm);
    const mcqs = await generateChapterMcqsCovered("Lecture", pages, llm);
    const notes = await generateChapterNotesCovered(
      {
        title: "Lecture",
        explanationEn: analysis.explanationEn,
        explanationAr: "",
        summary: analysis.chapterSummary,
        keyPoints: [],
        terms: [],
        visuals: [],
      },
      pages,
      analysis.sections,
      llm
    );
    const mindMap = await generateChapterMindMapCovered(
      {
        title: "Lecture",
        explanationEn: analysis.explanationEn,
        explanationAr: "",
        keyPoints: [],
        terms: [],
        flashcards: cards.items,
        mcqs: mcqs.items,
        validPages: pages.map(page => page.page),
        summarySections: analysis.sections,
      },
      pages,
      llm
    );

    for (const result of [cards, mcqs, notes, mindMap]) {
      expect(result.coverage.status).toBe("COMPLETE");
      expect(result.coverage.uncoveredChunks).toEqual([]);
    }

    // sourcePages prove the late facts came from their own pages.
    for (const page of LATE_PAGES) {
      const { keyword } = LATE_PAGE_FACTS[page];
      expect(
        cards.items.some(
          c => c.sourcePage === page && c.answerEn.includes(keyword)
        )
      ).toBe(true);
      expect(
        mcqs.items.some(
          m => m.sourcePage === page && m.questionEn.includes(keyword)
        )
      ).toBe(true);
      expect(
        notes.items.some(n =>
          n.blocks.some(
            b => b.sourcePages.includes(page) && b.bodyEn.includes(keyword)
          )
        )
      ).toBe(true);
      expect(
        mindMap.items.some(
          s => s.sourcePages.includes(page) && s.summaryEn.includes(keyword)
        )
      ).toBe(true);
    }

    // Every page 1–40 was actually sent to the model at least once.
    const sentPages = new Set(
      calls.flatMap(call => pagesFromPrompt(userText(call)).map(p => p.page))
    );
    expect(sentPages.size).toBe(40);
  });

  it("QUALITY GATE: output only from the first chunks FAILS even with 100% extraction", async () => {
    const { total, pages } = await extractPages();
    expect(validateExtractionCoverage(total, pages).status).toBe("COMPLETE");

    // A model that behaves like the original bug — even after the targeted
    // retry it only ever produces items from pages 1–8.
    const lazy = echoModel({ onlyUpToPage: 8 });
    const cards = await generateChapterFlashcardsCovered(
      "Lecture",
      pages,
      lazy
    );
    const mcqs = await generateChapterMcqsCovered("Lecture", pages, lazy);
    expect(cards.coverage.status).toBe("FAILED");
    expect(mcqs.coverage.status).toBe("FAILED");
    expect(cards.coverage.reasons.join(" ")).toMatch(
      /second half|chunks produced/
    );
    expect(cards.coverage.uncoveredChunks.length).toBeGreaterThan(0);

    const mindMap = await generateChapterMindMapCovered(
      {
        title: "Lecture",
        explanationEn: "",
        explanationAr: "",
        keyPoints: [],
        terms: [],
        flashcards: [],
        mcqs: [],
        validPages: pages.map(page => page.page),
        summarySections: [],
      },
      pages,
      lazy
    );
    expect(mindMap.coverage.status).toBe("FAILED");
  });

  it("QUALITY GATE: dropping the last chunks' results fails; items only from pages 1–3 fail", async () => {
    const { pages } = await extractPages();
    const { chunks } = buildDocumentChunks(pages);
    const types = classifyPages(pages);

    const allChunks = chunks.map(chunk => [chunk.pages[0]]);
    expect(
      validateOutputCoverage("mcqs", chunks, types, allChunks).status
    ).toBe("COMPLETE");

    // Last two chunks never processed.
    const withoutLast = chunks.slice(0, -2).map(chunk => [chunk.pages[0]]);
    expect(
      validateOutputCoverage("mcqs", chunks, types, withoutLast).status
    ).not.toBe("COMPLETE");

    // The reported bug exactly: everything cites pages 1–3.
    const introOnly = [[1], [2], [3], [1, 2]];
    const verdict = validateOutputCoverage(
      "flashcards",
      chunks,
      types,
      introOnly
    );
    expect(verdict.status).toBe("FAILED");

    // A summary whose late sections are empty is not a complete summary.
    const sections = chunks.map((chunk, i) => ({
      chunkId: chunk.id,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      summary: i < 2 ? "intro" : "",
    }));
    expect(summaryCoverageFromSections(pages, sections).status).toBe("FAILED");
  });

  it("book manifest is COMPLETE only when every page, chapter and output is covered", () => {
    const pages = Array.from({ length: 40 }, (_, i) => ({
      pageNumber: i + 1,
      textStatus: "complete",
      pageType: i < 3 ? "metadata" : "educational_content",
    }));
    const output = (status: "COMPLETE" | "FAILED") => ({
      kind: "mcqs" as const,
      itemCount: 5,
      totalChunks: 1,
      requiredChunks: ["chunk-1"],
      coveredChunks: status === "COMPLETE" ? ["chunk-1"] : [],
      uncoveredChunks: status === "COMPLETE" ? [] : ["chunk-1"],
      coveredPages: [],
      chunkCoveragePercent: status === "COMPLETE" ? 100 : 0,
      status,
      reasons: [],
    });
    const manifest = (status: "COMPLETE" | "FAILED") => ({
      version: 1 as const,
      updatedAt: "",
      totalPages: 8,
      extractedPages: 8,
      failedPages: [],
      pageTypes: {},
      chunks: [],
      chunksAnalyzed: 1,
      outputs: { mcqs: output(status) },
      status,
      errors: [],
    });
    const chapters = (status: "COMPLETE" | "FAILED") =>
      [1, 2, 3, 4, 5].map(i => ({
        id: `c${i}`,
        status: "complete",
        manifest: manifest(i === 5 ? status : "COMPLETE"),
      }));

    expect(
      buildBookProcessingManifest(40, pages, chapters("COMPLETE"), {
        cards: 0,
        mcqs: 25,
      }).status
    ).toBe("COMPLETE");
    expect(
      buildBookProcessingManifest(40, pages, chapters("FAILED"), {
        cards: 0,
        mcqs: 20,
      }).status
    ).toBe("FAILED");
    const withFailedPage = pages.map(p =>
      p.pageNumber === 38 ? { ...p, textStatus: "failed" } : p
    );
    const partial = buildBookProcessingManifest(
      40,
      withFailedPage,
      chapters("COMPLETE"),
      { cards: 0, mcqs: 25 }
    );
    expect(partial.status).toBe("PARTIAL");
    expect(partial.failedPages).toEqual([38]);
  });
});

describe("page numbers returned as strings", () => {
  it('keeps cards whose sourcePage is "35" (string), normalized to 35', async () => {
    const pages = [
      { page: 35, text: "Karvellin syndrome is treated with Oxetrazine." },
      { page: 36, text: "Doruvian nephritis shows Mirelle bodies." },
    ];
    const llm: Llm = async () => ({
      id: "x",
      created: 0,
      model: "m",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify({
              flashcards: [
                {
                  questionEn: "Q35",
                  questionAr: "",
                  answerEn: "Oxetrazine",
                  answerAr: "",
                  relatedTermEn: "",
                  sourcePage: "35",
                },
                {
                  questionEn: "Q36",
                  questionAr: "",
                  answerEn: "Mirelle",
                  answerAr: "",
                  relatedTermEn: "",
                  sourcePage: "36",
                },
              ],
            }),
          },
        },
      ],
    });
    const result = await generateChapterFlashcardsCovered("T", pages, llm);
    expect(result.items.map(c => c.sourcePage)).toEqual([35, 36]);
    expect(result.coverage.status).toBe("COMPLETE");
  });
});
