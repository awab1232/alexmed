import { invokeLLM } from "@/lib/llm";
import {
  buildOcrMessages,
  normalizePageText,
  ocrResponseSchema,
  OCR_MAX_TOKENS,
  OCR_MODEL,
  parseJsonResponse,
} from "@/lib/pdf-cards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export async function POST(request: Request) {
  const allowed = await checkRateLimit(
    `pdf:${getClientIp(request)}`,
    30,
    60 * 60
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "تجاوزت الحد المسموح من الطلبات. حاول لاحقًا." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    fileUrl?: string;
    pages?: number[];
  };
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : "";
  const pageNumbers = Array.isArray(body.pages)
    ? body.pages.filter(page => Number.isInteger(page) && page > 0).slice(0, 4)
    : [];

  if (!fileUrl || !pageNumbers.length) {
    return NextResponse.json(
      { error: "لا توجد صفحات مصوّرة لمعالجتها." },
      { status: 400 }
    );
  }

  let parser: PDFParse | undefined;
  try {
    const absoluteFileUrl = new URL(fileUrl, request.url).toString();
    parser = new PDFParse({ url: absoluteFileUrl });
    const pages: Array<{
      page: number;
      text: string;
      hasText: boolean;
      ocr: boolean;
    }> = [];
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
          model: OCR_MODEL,
          max_tokens: OCR_MAX_TOKENS,
          messages: buildOcrMessages(imageUrl),
          response_format: ocrResponseSchema,
        });
        const parsed = parseJsonResponse(
          response.choices[0]?.message.content
        ) as unknown as { text?: string };
        const text =
          typeof parsed.text === "string" ? normalizePageText(parsed.text) : "";
        if (!text) throw new Error("OCR returned empty text");
        pages.push({ page: pageNumber, text, hasText: true, ocr: true });
      } catch (error) {
        console.error(`[PDF OCR] Page ${pageNumber} failed`, error);
        failedPages.push(pageNumber);
        pages.push({ page: pageNumber, text: "", hasText: false, ocr: true });
      }
    }

    return NextResponse.json({ pages, failedPages });
  } catch (error) {
    console.error("[PDF OCR] Failed", error);
    return NextResponse.json(
      { error: "تعذر تشغيل OCR على الصفحات المصوّرة." },
      { status: 502 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
