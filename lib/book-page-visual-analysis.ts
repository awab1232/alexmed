// كتبي page-level visual analysis — deliberately separate from
// lib/book-analysis.ts (which stays text-only, chapter-scoped, and is the
// sole source of explanation/medicalTerms/chapterSummary — no duplication).
// This file's one job: given one page's image + whatever text extraction
// already found, ask a vision-capable model what's actually on the page,
// honestly. Reuses lib/pdf-cards.ts's OCR_MODEL/parseJsonResponse and
// lib/llm.ts's Message type — no new AI dependency.
import type { Message } from "./llm";
import { OCR_MODEL, parseJsonResponse } from "./pdf-cards";

export type BookVisualElementType =
  | "image"
  | "diagram"
  | "table"
  | "screenshot"
  | "chart";
export type BookVisualConfidence = "high" | "medium" | "low";

export type AnalyzedBookPageVisual = {
  assetType: BookVisualElementType;
  descriptionAr: string;
  descriptionEn: string;
  relatedTextAr?: string;
  relatedTextEn?: string;
  confidence: BookVisualConfidence;
  needsReview: boolean;
};

export type AnalyzedBookPage = {
  extractedText: string;
  visuals: AnalyzedBookPageVisual[];
  confidence: BookVisualConfidence;
  reviewStatus: "complete" | "needs_review";
};

export const PAGE_VISUAL_MODEL = OCR_MODEL;
export const PAGE_VISUAL_MAX_TOKENS = 4000;

const visualSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assetType: {
      type: "string",
      enum: ["image", "diagram", "table", "screenshot", "chart"],
    },
    descriptionAr: { type: "string" },
    descriptionEn: { type: "string" },
    relatedTextAr: { type: "string" },
    relatedTextEn: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    needsReview: { type: "boolean" },
  },
  required: [
    "assetType",
    "descriptionAr",
    "descriptionEn",
    "confidence",
    "needsReview",
  ],
};

export const pageVisualResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "book_page_visual_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        extractedText: { type: "string" },
        visuals: { type: "array", items: visualSchema },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        reviewStatus: { type: "string", enum: ["complete", "needs_review"] },
      },
      required: ["extractedText", "visuals", "confidence", "reviewStatus"],
    },
  },
};

// Instructions per the approved plan, translated verbatim from the user's
// own list — every bullet maps to a specific requirement, not paraphrased
// away.
export function buildPageVisualMessages(
  pageNumber: number,
  existingText: string,
  imageUrl: string
): Message[] {
  return [
    {
      role: "system",
      content: [
        "You are analyzing one page from a medical study PDF (page " +
          pageNumber +
          ") — it may contain plain text, medical images, X-rays/ultrasound, tables, flowcharts, algorithms, anatomical diagrams, screenshots, or diagnostic charts.",
        "Analyze the page using BOTH the provided text and the image together — do not rely on text extraction alone.",
        "Preserve the original page number exactly as given; you are only describing this one page.",
        "Never invent text that isn't clearly visible. If something is unclear or unreadable, say so rather than guessing.",
        'If a diagram or table is not clearly readable, set its confidence to "low" and needsReview to true.',
        "Keep a clear separation between text that is actually present on the page (extractedText) and your own descriptions/interpretations (the visuals[].description fields) — never blend the two.",
        "For each visual element, briefly relate it to the surrounding text if there is a clear connection (relatedTextAr/relatedTextEn).",
        "If you see a medical image (X-ray, ultrasound, histology, clinical photo, etc.), describe cautiously what is visible — do not state an unsupported diagnosis.",
        "If you see an algorithm or flowchart, extract its steps in order inside the description.",
        "If you see a table, preserve its rows/columns as faithfully as possible in the description.",
        "A page can contain more than one visual element — return one entry in visuals[] per distinct element you can identify.",
        "Return JSON only, matching the given schema exactly.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: existingText
            ? `Text already extracted from this page (may be incomplete):\n${existingText}`
            : "No text was extracted from this page by the normal text layer — it may be a scanned/image-only page.",
        },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      ],
    },
  ];
}

export function parsePageVisualAnalysis(content: unknown): AnalyzedBookPage {
  return parseJsonResponse(content) as unknown as AnalyzedBookPage;
}
