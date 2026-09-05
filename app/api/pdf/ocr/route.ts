import { auth } from "@/lib/auth";
import { ocrPages } from "@/lib/pdf-ocr";
import { storageGetSignedUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts for why.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value — set explicitly so the platform doesn't fall back to a lower
// default (10s) before our own AI-gateway timeout/retry budget can complete.
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
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
    // fileUrl is "/api/files/{key}" (from /api/pdf/extract's response) — that
    // route now requires a session, but this is a server-to-server fetch with
    // no browser cookies, so resolve the signed storage URL directly instead
    // of looping back through our own now-gated redirect endpoint.
    const key = fileUrl.replace(/^\/api\/files\//, "");
    const signedGetUrl = await storageGetSignedUrl(key);
    parser = new PDFParse({ url: signedGetUrl, CanvasFactory });
    const { pages, failedPages } = await ocrPages(parser, pageNumbers);

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
