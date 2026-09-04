import { auth } from "@/lib/auth";
import { normalizePageText } from "@/lib/pdf-cards";
import { storageGetSignedUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — pdf-parse's own troubleshooting docs
// require this for serverless platforms (Vercel/Lambda/...), where DOMMatrix
// isn't a native global: https://github.com/mehmet-kozan/pdf-parse/blob/main/docs/troubleshooting.md
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// The browser already PUT the raw file straight to storage via a presigned
// URL from /api/pdf/upload-url (see lib/storage.ts's storageGetUploadUrl for
// why: Vercel rejects request bodies over ~4.5MB before this route would ever
// run, so the old "upload the file as multipart form data" approach can't
// support large PDFs on Vercel). This route just needs the storage key back,
// same JSON-only request/response shape /api/pdf/ocr already uses.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    fileName?: string;
    fileSize?: number;
  };
  const key = typeof body.key === "string" ? body.key : "";
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

  if (!key) {
    return NextResponse.json({ error: "ارفع ملف PDF أولًا." }, { status: 400 });
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "الملف يجب أن يكون بصيغة PDF." },
      { status: 400 }
    );
  }

  let parser: PDFParse | undefined;
  try {
    const fileUrl = `/api/files/${key}`;
    // Fetch straight from storage via a signed URL rather than looping back
    // through our own /api/files/[...key] — that route now requires a signed-
    // in session (browser-navigable), but this is a server-to-server fetch
    // with no browser cookies to send, so it would 401 against itself.
    const signedGetUrl = await storageGetSignedUrl(key);
    parser = new PDFParse({ url: signedGetUrl, CanvasFactory });
    const result = await parser.getText();
    const pages = result.pages.map(page => ({
      page: page.num,
      text: normalizePageText(page.text),
      hasText: normalizePageText(page.text).length > 0,
    }));
    const pagesWithText = pages.filter(page => page.hasText).length;

    return NextResponse.json({
      fileName,
      fileSize,
      fileUrl,
      pageCount: result.total,
      pages,
      pagesWithText,
      pagesWithoutText: result.total - pagesWithText,
    });
  } catch (error) {
    console.error("[PDF] Extraction failed", error);
    return NextResponse.json(
      {
        error:
          "تعذر قراءة الملف. جرّب نسخة PDF قابلة لتحديد النص أو ملفًا أصغر.",
      },
      { status: 422 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
