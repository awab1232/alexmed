import type { Express, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

const cardSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string", description: "The original question in English, preserving options when present." },
    questionArabic: { type: "string", description: "A clear Arabic translation of the question." },
    answer: { type: "string", description: "The correct answer in English." },
    answerArabic: { type: "string", description: "The correct answer in Arabic." },
    explanation: { type: "string", description: "A concise teaching explanation in English." },
    explanationArabic: { type: "string", description: "A concise teaching explanation in Arabic." },
    keyIdea: { type: "string", description: "The core exam concept in English." },
    keyIdeaArabic: { type: "string", description: "The core exam concept in Arabic." },
    keyword: { type: "string", description: "The trigger word or phrase that points to the answer in English." },
    keywordArabic: { type: "string", description: "The trigger word or phrase in Arabic." },
    sourcePage: { type: "integer", description: "The PDF page number where the question appears." },
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

const responseSchema = {
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

const ocrResponseSchema = {
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

type PageInput = { page: number; text: string };

type GeneratedCard = {
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

function getMessageText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === "string" ? part : (part as { text?: string }).text ?? ""))
      .join("\n");
  }
  return "";
}

function parseJsonResponse(content: unknown) {
  const text = getMessageText(content).trim();
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(withoutFence) as { cards: GeneratedCard[] };
}

export function normalizePageText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function registerPdfRoutes(app: Express) {
  app.post("/api/pdf/extract", upload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "ارفع ملف PDF أولًا." });
      return;
    }

    if (req.file.mimetype !== "application/pdf" && !req.file.originalname.toLowerCase().endsWith(".pdf")) {
      res.status(400).json({ error: "الملف يجب أن يكون بصيغة PDF." });
      return;
    }

    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: req.file.buffer });
      const result = await parser.getText();
      const pages = result.pages.map(page => ({
        page: page.num,
        text: normalizePageText(page.text),
        hasText: normalizePageText(page.text).length > 0,
      }));
      const pagesWithText = pages.filter(page => page.hasText).length;
      const stored = await storagePut(
        `study-pdfs/${randomUUID()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        req.file.buffer,
        "application/pdf"
      );

      res.json({
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileUrl: stored.url,
        pageCount: result.total,
        pages,
        pagesWithText,
        pagesWithoutText: result.total - pagesWithText,
      });
    } catch (error) {
      console.error("[PDF] Extraction failed", error);
      res.status(422).json({ error: "تعذر قراءة الملف. جرّب نسخة PDF قابلة لتحديد النص أو ملفًا أصغر." });
    } finally {
      await parser?.destroy().catch(() => undefined);
    }
  });

  app.post("/api/pdf/ocr", async (req: Request, res: Response) => {
    const body = req.body as { fileUrl?: string; pages?: number[] };
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : "";
    const pageNumbers = Array.isArray(body.pages)
      ? body.pages.filter(page => Number.isInteger(page) && page > 0).slice(0, 4)
      : [];

    if (!fileUrl || !pageNumbers.length) {
      res.status(400).json({ error: "لا توجد صفحات مصوّرة لمعالجتها." });
      return;
    }

    let parser: PDFParse | undefined;
    try {
      const absoluteFileUrl = new URL(fileUrl, `${req.protocol}://${req.get("host")}`).toString();
      parser = new PDFParse({ url: absoluteFileUrl });
      const pages: Array<{ page: number; text: string; hasText: boolean; ocr: boolean }> = [];
      const failedPages: number[] = [];

      for (const pageNumber of pageNumbers) {
        try {
          const screenshot = await parser.getScreenshot({
            partial: [pageNumber],
            desiredWidth: 1800,
            imageDataUrl: true,
            imageBuffer: false,
          });
          const imageUrl = screenshot.pages[0]?.dataUrl;
          if (!imageUrl) throw new Error("OCR image was not produced");

          const response = await invokeLLM({
            model: "gemini-3-flash-preview",
            max_tokens: 7000,
            messages: [{
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Act as a high-accuracy OCR engine. Transcribe every visible word from this exam page, preserving question numbering, line breaks, answer choices, punctuation, English, and Arabic. Do not summarize, translate, solve, or invent text. If a word is unreadable, write [unclear] instead. Return JSON only.",
                },
                { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
              ],
            }],
            response_format: ocrResponseSchema,
          });
          const parsed = parseJsonResponse(response.choices[0]?.message.content) as unknown as { text?: string };
          const text = typeof parsed.text === "string" ? normalizePageText(parsed.text) : "";
          if (!text) throw new Error("OCR returned empty text");
          pages.push({ page: pageNumber, text, hasText: true, ocr: true });
        } catch (error) {
          console.error(`[PDF OCR] Page ${pageNumber} failed`, error);
          failedPages.push(pageNumber);
          pages.push({ page: pageNumber, text: "", hasText: false, ocr: true });
        }
      }

      res.json({ pages, failedPages });
    } catch (error) {
      console.error("[PDF OCR] Failed", error);
      res.status(502).json({ error: "تعذر تشغيل OCR على الصفحات المصوّرة." });
    } finally {
      await parser?.destroy().catch(() => undefined);
    }
  });

  app.post("/api/pdf/generate", async (req: Request, res: Response) => {
    const body = req.body as { pages?: PageInput[]; depth?: string };
    const pages = Array.isArray(body.pages) ? body.pages : [];
    const usablePages = pages
      .filter(page => Number.isInteger(page.page) && typeof page.text === "string" && page.text.trim())
      .slice(0, 4);

    if (!usablePages.length) {
      res.status(400).json({ error: "لا توجد أسئلة نصية في هذه الدفعة." });
      return;
    }

    const source = usablePages.map(item => `\n===== PDF PAGE ${item.page} =====\n${item.text}`).join("\n");
    const depth = body.depth === "detailed" ? "detailed" : body.depth === "quick" ? "quick" : "balanced";
    const detailInstruction = depth === "quick"
      ? "Keep explanations short, but never omit a question."
      : depth === "detailed"
        ? "Give a useful exam-focused explanation and briefly explain why the clue matters."
        : "Keep explanations concise but teach the reasoning behind the answer.";

    try {
      const response = await invokeLLM({
        model: "gemini-3-flash-preview",
        max_tokens: 14000,
        messages: [
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
        ],
        response_format: responseSchema,
      });

      const parsed = parseJsonResponse(response.choices[0]?.message.content);
      const cards = Array.isArray(parsed.cards)
        ? parsed.cards.map(card => ({
            id: randomUUID(),
            ...card,
            sourcePage: usablePages.some(page => page.page === card.sourcePage) ? card.sourcePage : usablePages[0].page,
          }))
        : [];
      res.json({ cards, pages: usablePages.map(page => page.page) });
    } catch (error) {
      console.error("[PDF] Card generation failed", error);
      res.status(502).json({ error: "تعذر توليد البطاقات لهذه الدفعة. أعد المحاولة، وسيبقى تقدم الصفحات السابقة محفوظًا في الشاشة." });
    }
  });

  app.use((error: unknown, _req: Request, res: Response, next: () => void) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "حجم الملف أكبر من 50MB في النسخة الحالية." });
      return;
    }
    next();
  });
}
