// 🔥 Exam Focus pipeline — pure logic (no I/O), shared by the queue workers
// (app/api/books/exam-focus/*), the tRPC router and the tests.
//
//   whole file → units (buildDocumentChunks: every page in exactly one
//   unit) → per unit: high-yield extraction (+ one follow-up for any page
//   the model skipped) → all units' facts → dedupe → order → coverage
//   validation → persisted deck.
//
// No card count is ever requested: each unit yields as many cards as its
// content deserves, and the deck size is simply what survives dedupe.
import type { BookPageInput } from "./book-analysis";
import { buildDocumentChunks } from "./document-coverage";
import {
  EXAM_FOCUS_CATEGORIES,
  EXAM_FOCUS_CATEGORY_INFO,
  isExamFocusCategory,
  type ExamFocusCategory,
} from "./exam-focus-categories";
import type { Message } from "./llm";

// ── Units ────────────────────────────────────────────────────────────────
// Smaller than the chapter sub-chunks (8 pages / 12k chars): extraction
// here is exhaustive rather than summarising, so each call's answer is long
// and a smaller input keeps it well inside the output budget.
export const EXAM_FOCUS_UNIT_MAX_PAGES = 6;
export const EXAM_FOCUS_UNIT_MAX_CHARS = 10_000;

// Pages with less text than this (a title slide, a blank page) are never
// demanded to produce a card by the coverage check.
export const MIN_CONTENT_CHARS = 80;

export type ExamFocusUnitPlan = {
  unitIndex: number;
  pageStart: number;
  pageEnd: number;
  pageTexts: BookPageInput[];
};

export function planExamFocusUnits(
  pages: BookPageInput[]
): ExamFocusUnitPlan[] {
  const withText = pages.filter(page => page.text.trim().length > 0);
  const { chunks, chunkPages } = buildDocumentChunks(
    withText,
    EXAM_FOCUS_UNIT_MAX_PAGES,
    EXAM_FOCUS_UNIT_MAX_CHARS
  );
  return chunks.map((chunk, index) => ({
    unitIndex: index,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    pageTexts: chunkPages[index],
  }));
}

// Figures/tables were already described by the page-visual pipeline; their
// descriptions are appended to the page text so exam facts that live only
// in a table or diagram are extracted too.
export function withVisualDescriptions(
  pages: BookPageInput[],
  visuals: {
    pageNumber: number;
    assetType: string;
    descriptionEn: string | null;
  }[]
): BookPageInput[] {
  const byPage = new Map<number, string[]>();
  for (const visual of visuals) {
    const description = visual.descriptionEn?.trim();
    if (!description) continue;
    const list = byPage.get(visual.pageNumber) ?? [];
    list.push(
      `[VISUAL ${visual.assetType} — page ${visual.pageNumber}] ${description}`
    );
    byPage.set(visual.pageNumber, list);
  }
  return pages.map(page => {
    const extra = byPage.get(page.page);
    return extra?.length
      ? { ...page, text: `${page.text}\n\n${extra.join("\n")}` }
      : page;
  });
}

// ── Extraction (one unit) ────────────────────────────────────────────────
export type ExamFocusFact = {
  category: ExamFocusCategory;
  topic: string;
  title: string;
  points: string[];
  highlightLabel: string;
  highlightText: string;
  flag: string;
  sourcePages: number[];
};

export type ExamFocusExtraction = {
  facts: ExamFocusFact[];
  pagesWithoutExamContent: number[];
};

// Includes headroom for reasoning models' hidden thinking (see
// lib/chapter-generation.ts's REASONING_HEADROOM_TOKENS); a ceiling, not a
// cost — short answers stop early.
export const EXAM_FOCUS_MAX_TOKENS = 14_000;

const factSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "topic",
    "title",
    "points",
    "highlightLabel",
    "highlightText",
    "flag",
    "sourcePages",
  ],
  properties: {
    category: { type: "string", enum: [...EXAM_FOCUS_CATEGORIES] },
    topic: {
      type: "string",
      description: "The section/heading of the source this fact belongs to.",
    },
    title: {
      type: "string",
      description: "Short topic line for the card, e.g. 'Chemical eye injury'.",
    },
    points: {
      type: "array",
      items: { type: "string" },
      description:
        "1–6 short lines: facts, 'A → B' arrows, 'Grade 1 → Excellent' lists, 'Acid: … / Alkali: …' comparisons. No paragraphs.",
    },
    highlightLabel: {
      type: "string",
      description:
        "Optional label of the single most important takeaway (e.g. 'MOST IMPORTANT', 'WHY IT MATTERS', 'KEY NUMBER'), or ''.",
    },
    highlightText: {
      type: "string",
      description: "That takeaway, or '' when highlightLabel is ''.",
    },
    flag: {
      type: "string",
      description:
        "If the source is ambiguous or contradicts itself on this point, say how; otherwise ''.",
    },
    sourcePages: {
      type: "array",
      items: { type: "integer" },
      description:
        "Page numbers (from the [PAGE n] markers) stating this fact.",
    },
  },
} as const;

export const examFocusResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "exam_focus_cards",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["cards", "pagesWithoutExamContent"],
      properties: {
        cards: { type: "array", items: factSchema },
        pagesWithoutExamContent: {
          type: "array",
          items: { type: "integer" },
          description:
            "Pages of this part with nothing exam-worthy (title, objectives, references, blank).",
        },
      },
    },
  },
};

function pagesBlock(pages: BookPageInput[]): string {
  return pages.map(page => `[PAGE ${page.page}]\n${page.text}`).join("\n\n");
}

const CATEGORY_GUIDE = EXAM_FOCUS_CATEGORIES.map(
  category => `${category} (${EXAM_FOCUS_CATEGORY_INFO[category].label})`
).join(", ");

export function buildExamFocusMessages(input: {
  fileName: string;
  unitLabel: string;
  pages: BookPageInput[];
  followUpPages?: number[];
}): Message[] {
  const pageNumbers = Array.from(new Set(input.pages.map(p => p.page)));
  const followUp = input.followUpPages?.length
    ? `\nA first pass produced NO card for pages ${input.followUpPages.join(", ")}. Read exactly these pages again: extract every exam-worthy fact they contain, or list them in pagesWithoutExamContent if they truly have none.`
    : "";
  return [
    {
      role: "system",
      content: [
        "You are a meticulous medical exam-prep editor building 'Exam Focus' cards: high-yield knowledge cards a medical student swipes through before an exam.",
        "Extract EVERY piece of information from the source that is important enough for a medical student to know, remember, distinguish or recognize in an exam, and turn each knowledge unit into one card.",
        "Rules:",
        "- Use ONLY what the source states. Never add outside medical knowledge. Preserve numbers, doses, durations, cutoffs, diagnostic criteria, classifications, contraindications and treatment sequences exactly; never change their meaning.",
        "- There is NO target number of cards. Produce as many as the content genuinely deserves: a dense page can need several cards, a title/objectives/references page none. Never pad, never split one fact into several cards, never repeat the same fact in two cards.",
        "- Do not compress aggressively: keep an important detail even if it looks secondary. But not every sentence deserves a card — judge by exam relevance.",
        "- One card = ONE topic. Never put unrelated facts in the same card just because they sit on the same page — a separate topic (another disease, drug or syndrome) gets its own card.",
        "- A card is a complete knowledge unit, NOT a question/answer pair. title = the topic; points = 1–6 short lines (bullets, arrows 'A → B', graded lists, 'X: … / Y: …' comparisons) — never a paragraph; highlight = the single most important takeaway when there is one.",
        `- category: pick the best fit from ${CATEGORY_GUIDE}. Use exam_trap for commonly confused points and exceptions, emergency for immediate/urgent management, numbers for cutoffs and values.`,
        "- sourcePages: the [PAGE n] numbers where the fact is stated — only pages of this part.",
        "- Facts in tables and in [VISUAL …] figure descriptions count too.",
        "- If the source is ambiguous or contradicts itself on a point, keep the card and describe the problem in flag instead of choosing an answer.",
        "- Cover the WHOLE part, from its first page to its last. Every page must either be cited by at least one card or be listed in pagesWithoutExamContent.",
        "- Write the cards in English, keeping the source's medical terminology.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `File: ${input.fileName}\nThis is ${input.unitLabel} (pages ${pageNumbers.join(", ")}).${followUp}\n\n${pagesBlock(input.pages)}`,
    },
  ];
}

function cleanLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function extractJson(content: string | undefined | null): unknown {
  if (!content) throw new Error("Empty model response");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(content.slice(start, end + 1));
}

// Validates and grounds one model answer to its unit: unknown categories
// fall back to high_yield, page numbers written as strings are normalised,
// citations outside the unit are dropped — and a card left with no valid
// page is dropped rather than guessed onto a page (a single-page unit can
// only have come from that page, so it's repaired there).
export function parseExamFocusExtraction(
  content: string | undefined | null,
  unitPages: number[]
): ExamFocusExtraction & { droppedUngrounded: number } {
  const raw = extractJson(content) as {
    cards?: unknown[];
    pagesWithoutExamContent?: unknown[];
  };
  const allowed = new Set(unitPages);
  let droppedUngrounded = 0;
  const facts: ExamFocusFact[] = [];
  for (const item of Array.isArray(raw.cards) ? raw.cards : []) {
    if (!item || typeof item !== "object") continue;
    const card = item as Record<string, unknown>;
    const title = cleanLine(card.title);
    const points = (Array.isArray(card.points) ? card.points : [])
      .map(cleanLine)
      .filter(Boolean)
      .slice(0, 8);
    if (!title || !points.length) continue;
    let sourcePages = Array.from(
      new Set(
        (Array.isArray(card.sourcePages) ? card.sourcePages : [])
          .map(Number)
          .filter(page => Number.isInteger(page) && allowed.has(page))
      )
    ).sort((a, b) => a - b);
    if (!sourcePages.length) {
      if (allowed.size === 1) sourcePages = [...allowed];
      else {
        droppedUngrounded += 1;
        continue;
      }
    }
    const highlightText = cleanLine(card.highlightText);
    facts.push({
      category: isExamFocusCategory(card.category)
        ? card.category
        : "high_yield",
      topic: cleanLine(card.topic),
      title,
      points,
      highlightLabel: highlightText ? cleanLine(card.highlightLabel) : "",
      highlightText,
      flag: cleanLine(card.flag),
      sourcePages,
    });
  }
  const pagesWithoutExamContent = Array.from(
    new Set(
      (Array.isArray(raw.pagesWithoutExamContent)
        ? raw.pagesWithoutExamContent
        : []
      )
        .map(Number)
        .filter(page => Number.isInteger(page) && allowed.has(page))
    )
  );
  return { facts, pagesWithoutExamContent, droppedUngrounded };
}

function contentCharsByPage(pages: BookPageInput[]): Map<number, number> {
  const chars = new Map<number, number>();
  for (const page of pages) {
    chars.set(page.page, (chars.get(page.page) ?? 0) + page.text.trim().length);
  }
  return chars;
}

// Pages of a unit with real content that no card cites and the model didn't
// declare empty — the ones the follow-up call is asked about.
export function uncoveredUnitPages(
  unitPages: BookPageInput[],
  facts: ExamFocusFact[],
  declaredEmpty: number[]
): number[] {
  const covered = new Set([
    ...facts.flatMap(fact => fact.sourcePages),
    ...declaredEmpty,
  ]);
  return [...contentCharsByPage(unitPages).entries()]
    .filter(([page, chars]) => chars >= MIN_CONTENT_CHARS && !covered.has(page))
    .map(([page]) => page)
    .sort((a, b) => a - b);
}

export type ExamFocusLlm = (params: {
  messages: Message[];
  max_tokens: number;
  response_format: typeof examFocusResponseSchema;
}) => Promise<{ choices: { message: { content: string } }[] }>;

export function unitLabel(unitIndex: number, totalUnits: number): string {
  return `part ${unitIndex + 1} of ${totalUnits}`;
}

// One unit, end to end: extraction, then ONE focused follow-up for any
// content page the first pass neither cited nor declared empty. Whatever is
// still uncovered after that is reported (never hidden) by the deck-level
// coverage check. A failed or unparseable first call throws — the worker
// turns that into a retry of just this unit.
export async function extractExamFocusUnit(input: {
  fileName: string;
  unitIndex: number;
  totalUnits: number;
  pageTexts: BookPageInput[];
  llm: ExamFocusLlm;
}): Promise<{
  facts: ExamFocusFact[];
  declaredEmptyPages: number[];
  uncoveredPages: number[];
}> {
  const unitPages = Array.from(new Set(input.pageTexts.map(p => p.page)));
  const label = unitLabel(input.unitIndex, input.totalUnits);
  const first = await input.llm({
    messages: buildExamFocusMessages({
      fileName: input.fileName,
      unitLabel: label,
      pages: input.pageTexts,
    }),
    max_tokens: EXAM_FOCUS_MAX_TOKENS,
    response_format: examFocusResponseSchema,
  });
  const parsed = parseExamFocusExtraction(
    first.choices[0]?.message.content,
    unitPages
  );
  const facts = [...parsed.facts];
  const declared = new Set(parsed.pagesWithoutExamContent);
  let uncovered = uncoveredUnitPages(input.pageTexts, facts, [...declared]);
  if (uncovered.length) {
    try {
      const retryPages = input.pageTexts.filter(page =>
        uncovered.includes(page.page)
      );
      const second = await input.llm({
        messages: buildExamFocusMessages({
          fileName: input.fileName,
          unitLabel: label,
          pages: retryPages,
          followUpPages: uncovered,
        }),
        max_tokens: EXAM_FOCUS_MAX_TOKENS,
        response_format: examFocusResponseSchema,
      });
      const extra = parseExamFocusExtraction(
        second.choices[0]?.message.content,
        uncovered
      );
      facts.push(...extra.facts);
      extra.pagesWithoutExamContent.forEach(page => declared.add(page));
    } catch (error) {
      // The first pass already succeeded — keep it; the leftover pages are
      // reported as uncovered instead of failing the whole unit.
      console.warn("[ExamFocus] follow-up pass failed", error);
    }
    uncovered = uncoveredUnitPages(input.pageTexts, facts, [...declared]);
  }
  return {
    facts,
    declaredEmptyPages: [...declared].sort((a, b) => a - b),
    uncoveredPages: uncovered,
  };
}

// ── Dedupe + order (whole deck) ──────────────────────────────────────────
const STOPWORDS = new Set(
  "a an the of and or is are was were be been to in on at for with by as from this that these those it its than then which who may can more most also into their there such not no".split(
    " "
  )
);

// Crude but predictable stemming: plural/verb endings off, then the first 6
// letters — "alkaline"/"alkali" → "alkali", "burns"/"burn" → "burn".
function stem(word: string): string {
  const base = word
    .replace(/ies$/, "y")
    .replace(/(es|s|ed|ing)$/, "")
    .slice(0, 6);
  return base || word;
}

export function factTokens(
  fact: Pick<ExamFocusFact, "title" | "points" | "highlightText">
): Set<string> {
  const text = [fact.title, ...fact.points, fact.highlightText]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ.]+/g, " ");
  const tokens = new Set<string>();
  for (const word of text.split(/\s+/)) {
    const clean = word.replace(/^\.+|\.+$/g, "");
    if (!clean || STOPWORDS.has(clean)) continue;
    tokens.add(/\d/.test(clean) ? clean : stem(clean));
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  const union = a.size + b.size - shared;
  return union ? shared / union : 0;
}

function containment(small: Set<string>, large: Set<string>): number {
  if (!small.size) return 0;
  let shared = 0;
  for (const token of small) if (large.has(token)) shared += 1;
  return shared / small.size;
}

// Two facts are the same knowledge when their wording nearly matches, or
// one says nothing the other doesn't (≥90% of a ≥4-token card inside a
// larger one). Numbers are whole tokens, so "15–30 min" never matches
// "5 min" on numbers alone.
export const DUPLICATE_JACCARD = 0.75;

export function isDuplicateFact(a: Set<string>, b: Set<string>): boolean {
  if (jaccard(a, b) >= DUPLICATE_JACCARD) return true;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  return small.size >= 4 && containment(small, large) >= 0.9;
}

export type OrderedFact = ExamFocusFact & { unitIndex: number };

function detail(fact: ExamFocusFact): number {
  return [fact.title, ...fact.points, fact.highlightText].join(" ").length;
}

// Keeps the more detailed card of each duplicate group, with the union of
// their source pages, the most urgent category and any ambiguity flag.
export function dedupeFacts(facts: OrderedFact[]): {
  facts: OrderedFact[];
  removed: number;
} {
  const kept: { fact: OrderedFact; tokens: Set<string> }[] = [];
  let removed = 0;
  for (const fact of facts) {
    const tokens = factTokens(fact);
    const match = kept.find(entry => isDuplicateFact(entry.tokens, tokens));
    if (!match) {
      kept.push({ fact: { ...fact }, tokens });
      continue;
    }
    removed += 1;
    const current = match.fact;
    const incomingWins = detail(fact) > detail(current);
    const winner = incomingWins ? fact : current;
    const category =
      EXAM_FOCUS_CATEGORY_INFO[fact.category].priority <
      EXAM_FOCUS_CATEGORY_INFO[current.category].priority
        ? fact.category
        : current.category;
    match.fact = {
      ...winner,
      category,
      flag: winner.flag || fact.flag || current.flag,
      unitIndex: Math.min(current.unitIndex, fact.unitIndex),
      sourcePages: Array.from(
        new Set([...current.sourcePages, ...fact.sourcePages])
      ).sort((a, b) => a - b),
    };
    if (incomingWins) match.tokens = tokens;
  }
  return { facts: kept.map(entry => entry.fact), removed };
}

// The file's own order is kept (part by part, i.e. topic progression);
// inside a part the most urgent / highest-yield cards come first.
export function orderFacts(facts: OrderedFact[]): OrderedFact[] {
  return facts
    .map((fact, index) => ({ fact, index }))
    .sort(
      (a, b) =>
        a.fact.unitIndex - b.fact.unitIndex ||
        EXAM_FOCUS_CATEGORY_INFO[a.fact.category].priority -
          EXAM_FOCUS_CATEGORY_INFO[b.fact.category].priority ||
        a.fact.sourcePages[0] - b.fact.sourcePages[0] ||
        a.index - b.index
    )
    .map(({ fact }) => fact);
}

// Lower-cased text the deck search (ILIKE) runs against — title, topic,
// every line, the highlight and the category label.
export function buildSearchText(fact: ExamFocusFact): string {
  const info = EXAM_FOCUS_CATEGORY_INFO[fact.category];
  return [
    fact.title,
    fact.topic,
    ...fact.points,
    fact.highlightLabel,
    fact.highlightText,
    info.label,
    info.labelAr,
  ]
    .join(" \n ")
    .toLowerCase();
}

// ── Coverage validation (whole deck) ─────────────────────────────────────
export type ExamFocusCoverageStatus = "COMPLETE" | "PARTIAL" | "FAILED";

export type ExamFocusCoverage = {
  status: ExamFocusCoverageStatus;
  totalPages: number;
  pagesWithText: number;
  pagesWithoutText: number[];
  unitsTotal: number;
  unitsComplete: number;
  failedRanges: { pageStart: number; pageEnd: number }[];
  contentPages: number;
  coveredContentPages: number;
  uncoveredContentPages: number[];
  extractedFacts: number;
  duplicatesRemoved: number;
  cards: number;
  percent: number;
};

export type UnitCoverageInput = {
  pageStart: number;
  pageEnd: number;
  status: string;
  pageTexts: BookPageInput[];
  declaredEmptyPages: number[];
};

// A page counts as covered when a card cites it or the model explicitly
// declared it has nothing exam-worthy; a failed unit's pages are reported
// as failed ranges, never silently dropped.
export function validateExamFocusCoverage(input: {
  totalPages: number;
  units: UnitCoverageInput[];
  cards: { sourcePages: number[] }[];
  extractedFacts: number;
  duplicatesRemoved: number;
}): ExamFocusCoverage {
  const textPages = new Set<number>();
  const contentPages = new Set<number>();
  const completedContentPages = new Set<number>();
  const declaredEmpty = new Set<number>();
  const failedRanges: { pageStart: number; pageEnd: number }[] = [];
  for (const unit of input.units) {
    unit.pageTexts.forEach(page => textPages.add(page.page));
    for (const [page, chars] of contentCharsByPage(unit.pageTexts)) {
      if (chars < MIN_CONTENT_CHARS) continue;
      contentPages.add(page);
      if (unit.status === "complete") completedContentPages.add(page);
    }
    if (unit.status === "complete") {
      unit.declaredEmptyPages.forEach(page => declaredEmpty.add(page));
    } else {
      failedRanges.push({ pageStart: unit.pageStart, pageEnd: unit.pageEnd });
    }
  }
  const cited = new Set(input.cards.flatMap(card => card.sourcePages));
  const uncoveredContentPages = [...contentPages]
    .filter(page => !cited.has(page) && !declaredEmpty.has(page))
    .sort((a, b) => a - b);
  const coveredContentPages = contentPages.size - uncoveredContentPages.length;
  const pagesWithoutText: number[] = [];
  for (let page = 1; page <= input.totalPages; page++) {
    if (!textPages.has(page)) pagesWithoutText.push(page);
  }
  const unitsComplete = input.units.filter(
    unit => unit.status === "complete"
  ).length;
  const status: ExamFocusCoverageStatus =
    !unitsComplete || (!input.cards.length && completedContentPages.size > 0)
      ? "FAILED"
      : failedRanges.length ||
          uncoveredContentPages.length ||
          pagesWithoutText.length
        ? "PARTIAL"
        : "COMPLETE";
  return {
    status,
    totalPages: input.totalPages,
    pagesWithText: textPages.size,
    pagesWithoutText,
    unitsTotal: input.units.length,
    unitsComplete,
    failedRanges,
    contentPages: contentPages.size,
    coveredContentPages,
    uncoveredContentPages,
    extractedFacts: input.extractedFacts,
    duplicatesRemoved: input.duplicatesRemoved,
    cards: input.cards.length,
    percent: contentPages.size
      ? Math.round((coveredContentPages / contentPages.size) * 100)
      : 100,
  };
}

// The whole finalize step, pure: facts from every unit → one ordered deck
// plus its coverage verdict.
export function composeExamFocusDeck(input: {
  totalPages: number;
  units: (UnitCoverageInput & { unitIndex: number; facts: ExamFocusFact[] })[];
}): { cards: OrderedFact[]; coverage: ExamFocusCoverage } {
  const all: OrderedFact[] = input.units
    .filter(unit => unit.status === "complete")
    .sort((a, b) => a.unitIndex - b.unitIndex)
    .flatMap(unit =>
      unit.facts.map(fact => ({ ...fact, unitIndex: unit.unitIndex }))
    );
  const { facts, removed } = dedupeFacts(all);
  const cards = orderFacts(facts);
  const coverage = validateExamFocusCoverage({
    totalPages: input.totalPages,
    units: input.units,
    cards,
    extractedFacts: all.length,
    duplicatesRemoved: removed,
  });
  return { cards, coverage };
}
