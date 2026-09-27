import { auth } from "@/lib/auth";
import { storageGetUploadUrl } from "@/lib/storage";
import { newUploadKey } from "@/lib/upload-keys";
import { NextResponse } from "next/server";
import { billingErrorResponse } from "@/lib/billing/http";
import { assertFileSizeAllowed } from "@/lib/billing/usage";

// Step 1 of the book upload flow — same direct-to-storage presigned-PUT
// pattern as /api/pdf/upload-url (see lib/storage.ts's storageGetUploadUrl),
// under its own "book-pdfs/" key prefix.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    fileName?: string;
    fileSize?: number;
    contentType?: string;
  };

  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : NaN;

  if (!fileName || !fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "الملف يجب أن يكون بصيغة PDF." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "حجم الملف غير صالح." }, { status: 400 });
  }
  // 💳 The student's plan decides the maximum size (lib/billing). This is
  // the early check; processing re-checks the stored file's real size.
  try {
    await assertFileSizeAllowed(session.user.id, fileSize);
  } catch (error) {
    const response = billingErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const key = newUploadKey("book-pdfs", session.user.id, fileName);
  // Always PDF: only .pdf names are accepted above, and the type is signed
  // into the upload URL — a client-chosen type (e.g. text/html) would let a
  // file be served back from storage as a web page.
  const contentType = "application/pdf";

  try {
    const uploadUrl = await storageGetUploadUrl(key, contentType);
    return NextResponse.json({ key, uploadUrl });
  } catch (error) {
    console.error("[Books] Failed to create upload URL", error);
    return NextResponse.json(
      { error: "تعذر تجهيز رابط الرفع. حاول مرة أخرى." },
      { status: 502 }
    );
  }
}
