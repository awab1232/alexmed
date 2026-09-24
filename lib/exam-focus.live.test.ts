// LIVE Exam Focus run over the 40-page PDF with the REAL model (invokeLLM
// via the configured gateway). Skipped unless LIVE_AI=1 — spends real AI
// credits (one call per unit, plus follow-ups). Never touches the database:
// it runs the exact pure functions the workers run, in the same order:
//   pdf-parse → planExamFocusUnits → extractExamFocusUnit per unit (3 at a
//   time, like the queue) → composeExamFocusDeck (dedupe/order/coverage).
//
//   LIVE_AI=1 npx vitest run lib/exam-focus.live.test.ts
import { config as loadEnv } from "dotenv";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { normalizePageText } from "./pdf-cards";
import {
  composeExamFocusDeck,
  extractExamFocusUnit,
  planExamFocusUnits,
  type ExamFocusLlm,
} from "./exam-focus";
import {
  buildFortyPageMedicalPdf,
  LATE_PAGE_FACTS,
} from "./test-fixtures/forty-page-medical-pdf";

const live = process.env.LIVE_AI === "1";
if (live) loadEnv();

describe.skipIf(!live)("LIVE Exam Focus — 40-page PDF", () => {
  it(
    "extracts high-yield cards from all 40 pages with the real model",
    async () => {
      const { invokeLLM } = await import("./llm");
      const llm: ExamFocusLlm = params => invokeLLM(params);

      const parser = new PDFParse({ data: buildFortyPageMedicalPdf() });
      const parsed = await parser.getText();
      await parser.destroy();
      const pages = parsed.pages.map(page => ({
        page: page.num,
        text: normalizePageText(page.text),
      }));
      expect(pages).toHaveLength(40);

      const units = planExamFocusUnits(pages);
      const started = Date.now();
      const results: {
        unitIndex: number;
        status: string;
        ms: number;
        facts: number;
        uncovered: number[];
        error?: string;
      }[] = [];
      const extracted = new Array(units.length);
      let next = 0;
      async function worker() {
        while (next < units.length) {
          const plan = units[next++];
          const t0 = Date.now();
          try {
            const result = await extractExamFocusUnit({
              fileName: "forty-page-medical.pdf",
              unitIndex: plan.unitIndex,
              totalUnits: units.length,
              pageTexts: plan.pageTexts,
              llm,
            });
            extracted[plan.unitIndex] = {
              ...plan,
              status: "complete",
              facts: result.facts,
              declaredEmptyPages: result.declaredEmptyPages,
            };
            results.push({
              unitIndex: plan.unitIndex,
              status: "complete",
              ms: Date.now() - t0,
              facts: result.facts.length,
              uncovered: result.uncoveredPages,
            });
          } catch (error) {
            // As in the worker after its retries: a failed unit is kept as
            // failed, never dropped silently.
            extracted[plan.unitIndex] = {
              ...plan,
              status: "failed",
              facts: [],
              declaredEmptyPages: [],
            };
            results.push({
              unitIndex: plan.unitIndex,
              status: "failed",
              ms: Date.now() - t0,
              facts: 0,
              uncovered: [],
              error: String(error),
            });
          }
        }
      }
      await Promise.all([worker(), worker(), worker()]);

      const { cards, coverage } = composeExamFocusDeck({
        totalPages: 40,
        units: extracted,
      });
      const allText = cards
        .map(card => [card.title, ...card.points, card.highlightText].join(" "))
        .join(" ")
        .toLowerCase();
      const latePagesFound = Object.entries(LATE_PAGE_FACTS).map(
        ([page, fact]) => ({
          page: Number(page),
          keyword: fact.keyword,
          found: allText.includes(fact.keyword.toLowerCase()),
        })
      );
      const byCategory: Record<string, number> = {};
      for (const card of cards) {
        byCategory[card.category] = (byCategory[card.category] ?? 0) + 1;
      }

      const summary = {
        totalMs: Date.now() - started,
        units: results.sort((a, b) => a.unitIndex - b.unitIndex),
        coverage: {
          status: coverage.status,
          percent: coverage.percent,
          uncovered: coverage.uncoveredContentPages,
          failedRanges: coverage.failedRanges,
          extractedFacts: coverage.extractedFacts,
          duplicatesRemoved: coverage.duplicatesRemoved,
        },
        cards: cards.length,
        byCategory,
        latePagesFound,
      };
      writeFileSync(
        process.env.LIVE_REPORT ?? "exam-focus-live-report.json",
        JSON.stringify(
          { ...summary, sample: cards.slice(0, 6), last: cards.slice(-4) },
          null,
          2
        )
      );
      console.log(JSON.stringify(summary, null, 2));

      // Not "HTTP 200 = done": every unit analysed, the deck has cards, the
      // last pages are really covered, and every card cites real pages.
      expect(results.every(r => r.status === "complete")).toBe(true);
      expect(cards.length).toBeGreaterThan(0);
      const cited = new Set(cards.flatMap(card => card.sourcePages));
      expect(Math.max(...cited)).toBeGreaterThanOrEqual(36);
      expect(latePagesFound.filter(p => p.found).length).toBeGreaterThanOrEqual(
        latePagesFound.length - 1
      );
      expect(
        cards.every(card =>
          card.sourcePages.every(page => page >= 1 && page <= 40)
        )
      ).toBe(true);
    },
    Number(process.env.LIVE_TIMEOUT_MS ?? 900_000)
  );
});
