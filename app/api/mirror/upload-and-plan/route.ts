import { auth } from "@/lib/auth";
import { createMirrorJobShell } from "@/lib/db-mirror";
import { publishMessage } from "@/lib/queue/client";
import {
  assertJobCreationAllowed,
  RateLimitedError,
} from "@/lib/queue/rateLimit";
import { NextResponse } from "next/server";

// Step 1 of the مِرآة pipeline: the browser already PUT the raw file straight
// to storage via /api/pdf/upload-url. This route now only creates a bare job
// row (status "extracting") and publishes a single extract_mirror_job
// message — it never touches the PDF itself, so it always responds in well
// under a second regardless of file size or how many pages need OCR. The
// actual text-extraction + OCR runs in the background
// (app/api/mirror/extract/route.ts), which is what fixes the
// FUNCTION_INVOCATION_TIMEOUT (504) this route used to risk on multi-page
// scanned files: OCR here was previously synchronous, capped only by
// Vercel's 60s function ceiling.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "الرجاء تسجيل الدخول أولاً." },
      { status: 401 }
    );
  }

  try {
    await assertJobCreationAllowed(session.user.id, "mirror");
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    fileName?: string;
    depth?: string;
  };
  const key = typeof body.key === "string" ? body.key : "";
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const depth =
    body.depth === "detailed"
      ? "detailed"
      : body.depth === "quick"
        ? "quick"
        : "balanced";

  if (!key) {
    return NextResponse.json({ error: "ارفع ملف PDF أولًا." }, { status: 400 });
  }
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "الملف يجب أن يكون بصيغة PDF." },
      { status: 400 }
    );
  }

  const job = await createMirrorJobShell(session.user.id, {
    fileName,
    fileKey: key,
    depth,
  });

  try {
    await publishMessage(
      { type: "extract_mirror_job", jobId: job.id },
      { flowControl: { key: `mirror-extract-${job.id}`, parallelism: 1 } }
    );
  } catch (publishError) {
    console.error("[Mirror] Failed to enqueue extraction", publishError);
    return NextResponse.json(
      {
        error: "تم إنشاء الملف لكن تعذر بدء المعالجة. حاول إعادة رفع الملف.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ jobId: job.id });
}
