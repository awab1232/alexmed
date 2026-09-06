import { finalizeMirrorJobIfDone } from "@/lib/db-mirror";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// Idempotent, best-effort finalize — safe to run repeatedly (the batch
// worker also calls finalizeMirrorJobIfDone directly after each batch, so
// this route mostly exists as a defensive backstop QStash-published message
// in case a batch's own inline finalize call somehow didn't fire).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request.url);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody) as { jobId?: string };
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (!jobId) {
      return NextResponse.json({ error: "معرف الملف مفقود." }, { status: 200 });
    }

    await finalizeMirrorJobIfDone(jobId);
    return NextResponse.json({ jobId, status: "checked" });
  } catch (error) {
    console.error("[Mirror] Finalize failed", error);
    return NextResponse.json(
      { error: "تعذر التحقق من الملف." },
      { status: 502 }
    );
  }
}
