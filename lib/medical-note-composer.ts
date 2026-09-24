import type { Message } from "./llm";
import { parseJsonResponse } from "./pdf-cards";

export type MedicalNoteBlock = {
  kind:
    | "definition"
    | "bullet_group"
    | "alert"
    | "comparison"
    | "algorithm"
    | "image";
  heading: string;
  bodyEn: string;
  bodyAr: string;
  items: string[];
  tone: "default" | "high_yield" | "warning" | "clinical";
  sourcePages: number[];
};

export type MedicalNotePage = {
  title: string;
  subtitle: string;
  layout: "overview" | "sections" | "comparison" | "algorithm" | "exam";
  sourcePages: number[];
  blocks: MedicalNoteBlock[];
};

const blockSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: [
        "definition",
        "bullet_group",
        "alert",
        "comparison",
        "algorithm",
        "image",
      ],
    },
    heading: { type: "string" },
    bodyEn: { type: "string" },
    bodyAr: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    tone: {
      type: "string",
      enum: ["default", "high_yield", "warning", "clinical"],
    },
    sourcePages: { type: "array", items: { type: "integer" } },
  },
  required: [
    "kind",
    "heading",
    "bodyEn",
    "bodyAr",
    "items",
    "tone",
    "sourcePages",
  ],
};

export const medicalNotePagesResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "medical_note_composer_pages",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pages: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              layout: {
                type: "string",
                enum: [
                  "overview",
                  "sections",
                  "comparison",
                  "algorithm",
                  "exam",
                ],
              },
              sourcePages: { type: "array", items: { type: "integer" } },
              blocks: { type: "array", items: blockSchema },
            },
            required: ["title", "subtitle", "layout", "sourcePages", "blocks"],
          },
        },
      },
      required: ["pages"],
    },
  },
};

export function buildMedicalNoteComposerMessages(input: {
  title: string;
  explanationEn: string;
  explanationAr: string;
  summary: string;
  keyPoints: string[];
  terms: { en: string; ar: string }[];
  pages: { page: number; text: string }[];
  visuals: {
    pageNumber: number;
    assetType: string;
    descriptionEn: string | null;
    descriptionAr: string | null;
  }[];
  // Set when the chapter is composed chunk by chunk (lib/chapter-generation.ts)
  // — e.g. "part 2 of 4, pages 9–16". Omitted = the original single call.
  partLabel?: string;
}): Message[] {
  const pageText = input.pages
    .map(page => `[PAGE ${page.page}]\n${page.text}`)
    .join("\n\n");
  const visuals = input.visuals
    .map(
      v =>
        `[PAGE ${v.pageNumber}] ${v.assetType}: ${v.descriptionEn ?? ""} / ${v.descriptionAr ?? ""}`
    )
    .join("\n");
  return [
    {
      role: "system",
      content: [
        "You are an expert medical note designer and exam-focused editor.",
        "Transform the entire source chapter into polished, page-ready medical revision notes similar to a high-yield handwritten lecture sheet, but digitally clean.",
        "Cover the full source; never omit a distinct fact. Use English as the primary language and add concise Arabic support without replacing English.",
        "Choose a logical structure for this topic: Definition, Types, Causes, Clinical features, Diagnosis/Investigations, Management, Complications, Red flags, Exam pearls, or an appropriate equivalent. Do not force irrelevant headings.",
        ...(input.partLabel
          ? [
              `The source below is ${input.partLabel} of the chapter; the other parts are composed separately. Write notes for THIS part only, covering all of it, in 1-3 pages.`,
            ]
          : []),
        "Create 3-8 coherent pages (1-3 when composing one part). Each page should have 2-5 blocks, short bullets, visual hierarchy, and real sourcePages. Put thresholds, durations, classifications, treatment steps, and danger signs into high-yield or warning blocks.",
        "Never invent facts. Every block and page must cite only real PDF pages from the supplied PAGE markers. Do not write unsupported diagnoses for images.",
        "Return JSON only. Keep bodyEn and items concise enough to fit a study page; bodyAr is a short support explanation.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter title: ${input.title}`,
        `Existing English explanation:\n${input.explanationEn}`,
        `Existing Arabic explanation:\n${input.explanationAr}`,
        `Existing summary:\n${input.summary}`,
        `High-yield points:\n${input.keyPoints.map(point => `- ${point}`).join("\n")}`,
        `Terms:\n${input.terms.map(term => `- ${term.en} = ${term.ar}`).join("\n")}`,
        `Full source pages:\n${pageText}`,
        `Visual evidence:\n${visuals || "No visual evidence was detected."}`,
      ].join("\n\n"),
    },
  ];
}

export function parseMedicalNotePages(
  content: unknown,
  validPages: number[]
): MedicalNotePage[] {
  const parsed = parseJsonResponse(content) as unknown as {
    pages: MedicalNotePage[];
  };
  const valid = new Set(validPages);
  return parsed.pages.map(page => ({
    ...page,
    sourcePages: page.sourcePages.filter(p => valid.has(p)),
    blocks: page.blocks.map(block => ({
      ...block,
      sourcePages: block.sourcePages.filter(p => valid.has(p)),
    })),
  }));
}
