// Core PDF -> study-card logic (schemas, prompts, text normalization). Ported
// unchanged from the original Express implementation — only the HTTP glue
// around this moved to Next.js Route Handlers (see app/api/pdf/*).
import { DEFAULT_VISION_MODEL, type Message } from "./llm";

export const cardSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: {
      type: "string",
      description:
        "The original question in English, preserving options when present.",
    },
    questionArabic: {
      type: "string",
      description: "A clear Arabic translation of the question.",
    },
    answer: { type: "string", description: "The correct answer in English." },
    answerArabic: {
      type: "string",
      description: "The correct answer in Arabic.",
    },
    explanation: {
      type: "string",
      description: "A concise teaching explanation in English.",
    },
    explanationArabic: {
      type: "string",
      description: "A concise teaching explanation in Arabic.",
    },
    keyIdea: {
      type: "string",
      description: "The core exam concept in English.",
    },
    keyIdeaArabic: {
      type: "string",
      description: "The core exam concept in Arabic.",
    },
    keyword: {
      type: "string",
      description:
        "The trigger word or phrase that points to the answer in English.",
    },
    keywordArabic: {
      type: "string",
      description: "The trigger word or phrase in Arabic.",
    },
    sourcePage: {
      type: "integer",
      description: "The PDF page number where the question appears.",
    },
    status: { type: "string", enum: ["complete", "needs_review"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: [
    "question",
    "questionArabic",
    "answer",
    "answerArabic",
    "explanation",
    "explanationArabic",
    "keyIdea",
    "keyIdeaArabic",
    "keyword",
    "keywordArabic",
    "sourcePage",
    "status",
    "confidence",
  ],
};

export const responseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "study_cards",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cards: { type: "array", items: cardSchema },
      },
      required: ["cards"],
    },
  },
};

export const ocrResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "ocr_page",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
};

export type PageInput = { page: number; text: string };

export type GeneratedCard = {
  question: string;
  questionArabic: string;
  answer: string;
  answerArabic: string;
  explanation: string;
  explanationArabic: string;
  keyIdea: string;
  keyIdeaArabic: string;
  keyword: string;
  keywordArabic: string;
  sourcePage: number;
  status: "complete" | "needs_review";
  confidence: "high" | "medium" | "low";
};

export function getMessageText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part =>
        typeof part === "string"
          ? part
          : ((part as { text?: string }).text ?? "")
      )
      .join("\n");
  }
  return "";
}

export function parseJsonResponse(content: unknown) {
  const text = getMessageText(content).trim();
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(withoutFence) as { cards: GeneratedCard[] };
  } catch (error) {
    // Some models (observed live with a few free OpenRouter models) wrap the
    // JSON in explanatory prose or chain-of-thought despite the "Return JSON
    // only" instruction. Best-effort recovery: grab the outermost {...}
    // block and retry once before giving up.
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1)) as {
        cards: GeneratedCard[];
      };
    }
    throw error;
  }
}

const NULL_BYTE = String.fromCharCode(0);

export function normalizePageText(text: string) {
  return text
    .split(NULL_BYTE)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// OCR always needs a vision-capable model; not user-selectable in the UI.
export const OCR_MODEL = DEFAULT_VISION_MODEL;
export const OCR_MAX_TOKENS = 7000;
export const GENERATE_MAX_TOKENS = 14000;

export function buildOcrMessages(imageUrl: string): Message[] {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Act as a high-accuracy OCR engine. Transcribe every visible word from this exam page, preserving question numbering, line breaks, answer choices, punctuation, English, and Arabic. Do not summarize, translate, solve, or invent text. If a word is unreadable, write [unclear] instead. Return JSON only.",
        },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      ],
    },
  ];
}

export function buildGenerateMessages(
  usablePages: PageInput[],
  depth: string
): Message[] {
  const source = usablePages
    .map(item => `\n===== PDF PAGE ${item.page} =====\n${item.text}`)
    .join("\n");
  const detailInstruction =
    depth === "quick"
      ? "Keep explanations short, but never omit a question."
      : depth === "detailed"
        ? "Give a useful exam-focused explanation and briefly explain why the clue matters."
        : "Keep explanations concise but teach the reasoning behind the answer.";

  return [
    {
      role: "system",
      content: [
        "You are a meticulous medical exam study-card editor.",
        "The user supplied text extracted from a PDF. Create exactly one flashcard for every distinct question, including questions that are written as notes or have incomplete wording.",
        "Do not silently discard a question. If the source is incomplete or the answer is uncertain, preserve what is available, set status to needs_review and confidence to low or medium, and explain the uncertainty briefly in the explanation.",
        "Preserve answer choices inside question when they exist. Do not invent options or unsupported facts.",
        "Answer in both English and Modern Standard Arabic. Keep medical terms in English in parentheses when that improves recall.",
        "Use the PDF page markers to assign sourcePage. Return JSON only.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `${detailInstruction}\n\nExtract cards from these pages:\n${source}`,
    },
  ];
}
