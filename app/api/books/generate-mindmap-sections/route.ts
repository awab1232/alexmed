import { getChapterById } from "@/lib/db-books";
import { enqueueChapterGeneration } from "@/lib/generation-jobs";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

// Legacy destination for "generate_chapter_mindmap_sections" messages.
// Mind-map generation now runs as a chapter_generation_jobs job
// (lib/generation-jobs.ts, app/api/books/generation-job) with an atomic
// claim; analyze-chapter enqueues that directly. This route only drains
// messages published before that change: it turns each one into the same
// job (a no-op if one is already queued/running), so nothing in flight is
// lost and nothing runs twice.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let chapterId: string;
  try {
    const body = JSON.parse(rawBody) as { chapterId?: string };
    chapterId = typeof body.chapterId === "string" ? body.chapterId : "";
    if (!chapterId) {
      return NextResponse.json({ error: "معرف الفصل مفقود." }, { status: 200 });
    }
  } catch (error) {
    console.error("[Books] generate-mindmap-sections body parse failed", error);
    return NextResponse.json({ error: "تعذر قراءة الطلب." }, { status: 502 });
  }

  const chapter = await getChapterById(chapterId);
  if (!chapter || chapter.status !== "complete") {
    return NextResponse.json({ chapterId, status: "skipped" });
  }

  try {
    const job = await enqueueChapterGeneration({
      chapterId,
      bookId: chapter.bookId,
      userId: chapter.userId,
      kind: "mindmap",
    });
    return NextResponse.json({ chapterId, status: "queued", jobId: job.id });
  } catch (error) {
    console.error("[Books] generate-mindmap-sections enqueue failed", error);
    // Nothing enqueued — let QStash retry the delivery.
    return NextResponse.json({ error: "تعذر إضافة المهمة." }, { status: 502 });
  }
}
