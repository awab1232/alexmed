// Multimodal question-files pipeline — pure message-builders, JSON schemas,
// parsers, and the image-to-questions association rule. Deliberately its own
// file (not lib/question-extraction.ts, which stays pure regex/no-AI per its
// own header comment, and not lib/book-analysis.ts, which is كتبي-chapter
// scoped) since this is a distinct vertical (extractedQuestions, not
// bookChapters/bookCards/bookMcqs) with its own two-stage AI pipeline:
//   - Stage 2 (buildPageImageClassificationMessages): cheap, per-page,
//     "does this page contain a real figure worth keeping" — never per
//     question, so a 300-question file with 20 images only pays for 20 of
//     these, not 300.
//   - Stage 3 (buildExtractedQuestionEnrichmentMessages): per question,
//     text-only or vision depending on whether that question has an
//     associated image — this is the one the user explicitly required to
//     "actually inspect the image" per question, not a cached description.
import type { Message } from "./llm";
import { parseJsonResponse } from "./pdf-cards";

// ── Stage 2: page image classification ──────────────────────────────────
// Live-reproduced bug (2026-09-19): the previous 200-token cap silently
// truncated a "thinking"-style model (gemini-2.5-flash) before it reached the
// actual JSON — its reasoning tokens share the same max_tokens budget, so a
// tight cap can cut off the answer entirely, not just make it terse. Raised
// well above what the tiny {hasImage, captionEn} output itself needs to
// leave room for that reasoning.
export const PAGE_IMAGE_CLASSIFICATION_MAX_TOKENS = 600;

export type PageImageClassification = {
  hasImage: boolean;
  captionEn: string;
  isAtPageEnd: boolean;
};

export const pageImageClassificationResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "question_file_page_image_classification",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        hasImage: {
          type: "boolean",
          description:
            "true only if this page contains a real figure/photo/diagram/chart worth keeping — false for a page that is plain body text (even if it has a logo, watermark, or decorative border).",
        },
        captionEn: {
          type: "string",
          description:
            "A short (one sentence) English caption of the figure if hasImage is true, otherwise an empty string.",
        },
        isAtPageEnd: {
          type: "boolean",
          description:
            "Only meaningful when hasImage is true. true if the figure sits at the bottom of the page with NO exam question or answer text below it on this same page (the questions about it likely start at the TOP of the next page, after a page break). false if there is question/answer text on this same page below the figure, or hasImage is false.",
        },
      },
      required: ["hasImage", "captionEn", "isAtPageEnd"],
    },
  },
};

export function buildPageImageClassificationMessages(
  pageNumber: number,
  imageUrl: string
): Message[] {
  return [
    {
      role: "system",
      content: [
        `You are looking at page ${pageNumber} of a scanned exam/question-bank PDF.`,
        "Decide whether this page contains a real, meaningful figure — a photo, X-ray/scan, diagram, chart, table, or instrument image — as opposed to a page that is just printed question/answer text.",
        "A page with only text (even dense text, headers, or page numbers) is NOT an image page.",
        "If it does have a figure, also decide whether any exam question or answer text appears BELOW it on this same page. A figure at the very bottom of the page with nothing (or only a page number/footer) below it usually means the question(s) about it are on the NEXT page instead.",
        "Return JSON only, matching the given schema exactly.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
      ],
    },
  ];
}

export function parsePageImageClassification(
  content: unknown
): PageImageClassification {
  return parseJsonResponse(content) as unknown as PageImageClassification;
}

// ── Stage 3: per-question enrichment ────────────────────────────────────
export type ExtractedQuestionEnrichment = {
  keywords: string[];
  explanationAr: string;
  inferredAnswerIndex: number | null;
};

export const extractedQuestionEnrichmentResponseSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "extracted_question_enrichment",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "3-6 short English keywords/tags for this question.",
        },
        explanationAr: {
          type: "string",
          description:
            "An Arabic explanation of the correct answer, keeping English medical/technical terms visible inline rather than translating them.",
        },
        inferredAnswerIndex: {
          type: ["integer", "null"],
          description:
            "0-based index into the question's own options for your best-supported answer, ONLY if the caller tells you no answer was stated in the source — otherwise null.",
        },
      },
      required: ["keywords", "explanationAr", "inferredAnswerIndex"],
    },
  },
};

// question.extractedAnswerText is passed through (not just the index) so the
// model always sees whatever the source already states, in both branches —
// it must ground explanationAr in that stated answer when one exists, and
// must only attempt inferredAnswerIndex when told none exists.
export function buildExtractedQuestionEnrichmentMessages(
  question: {
    questionText: string;
    options: string[] | null;
    extractedAnswerText: string | null;
  },
  // A URL the vision model can fetch — a signed object-storage GET url or a
  // base64 data: URI both work identically here (OpenAI-compatible
  // image_url.url accepts either).
  imageUrl: string | null
): Message[] {
  const hasStatedAnswer = !!question.extractedAnswerText;
  const optionsBlock = question.options?.length
    ? question.options
        .map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`)
        .join("\n")
    : "(no options given — this is not a multiple-choice question)";

  const systemLines = [
    "You are a study assistant producing exam-prep metadata for one extracted question from a real past-exam PDF.",
    "Produce 3-6 short English keywords for this question, and an Arabic explanation of the correct answer that keeps English medical/technical terminology visible inline (do not translate the terms themselves).",
    "Do not invent facts beyond what the question, its options, and (if given) the image actually support.",
    "Return JSON only, matching the given schema exactly.",
  ];

  if (hasStatedAnswer) {
    systemLines.push(
      `The source PDF already states the correct answer: "${question.extractedAnswerText}". Ground your explanation in that stated answer — always return inferredAnswerIndex as null, never second-guess it.`
    );
  } else {
    systemLines.push(
      "The source PDF does NOT state a correct answer for this question. Using the question, its options, and the image if given, infer the single best-supported answer and return its 0-based option index as inferredAnswerIndex — only if you are genuinely confident; otherwise return null rather than guessing."
    );
  }

  const userContent: Message["content"] = imageUrl
    ? [
        {
          type: "text",
          text: `Question: ${question.questionText}\nOptions:\n${optionsBlock}`,
        },
        { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
      ]
    : `Question: ${question.questionText}\nOptions:\n${optionsBlock}`;

  return [
    { role: "system", content: systemLines.join("\n") },
    { role: "user", content: userContent },
  ];
}

export function parseExtractedQuestionEnrichment(
  content: unknown
): ExtractedQuestionEnrichment {
  return parseJsonResponse(content) as unknown as ExtractedQuestionEnrichment;
}

// ── Image <-> question association (pure, no AI) ────────────────────────
// Sort images by pageNumber; each image at page P owns every question whose
// sourcePage is in [P, nextImagePage) — see the approved plan's TEST A-D.
// Deliberately page-position-based, never text-phrase matching ("the
// instrument shown above" etc.), per the user's explicit instruction.
export function associateImagesWithQuestions(
  images: { id: string; pageNumber: number; isAtPageEnd?: boolean }[],
  questions: { id: string; sourcePage: number }[]
): { questionId: string; imageId: string }[] {
  if (!images.length) return [];

  // Live-reproduced (2026-09-19): a figure at the bottom of its page with no
  // question text below it belongs to the questions starting the NEXT page,
  // not to whatever unrelated question happens to sit on its own page —
  // shifting its effective ownership start to pageNumber + 1 fixes exactly
  // that case without disturbing the (more common) same-page pattern, where
  // a figure is immediately followed by the question(s) about it.
  const sortedImages = [...images]
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(image => ({
      ...image,
      effectiveStart: image.isAtPageEnd
        ? image.pageNumber + 1
        : image.pageNumber,
    }));
  const relations: { questionId: string; imageId: string }[] = [];

  for (const question of questions) {
    let owner: (typeof sortedImages)[number] | null = null;
    for (const image of sortedImages) {
      if (
        image.effectiveStart <= question.sourcePage &&
        (!owner || image.effectiveStart >= owner.effectiveStart)
      ) {
        owner = image;
      }
    }
    if (owner) {
      relations.push({ questionId: question.id, imageId: owner.id });
    }
  }

  return relations;
}
