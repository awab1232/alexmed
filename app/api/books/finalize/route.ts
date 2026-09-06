import { finalizeBookIfDone } from "@/lib/db-books";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// Idempotent, best-effort finalize — defensive backstop for the finalize_book
// message; the chapter worker already calls finalizeBookIfDone directly
// after each chapter (Phase 1's FOR UPDATE-guarded implementation).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request.url);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody) as { bookId?: string };
    const bookId = typeof body.bookId === "string" ? body.bookId : "";
    if (!bookId) {
      return NextResponse.json(
        { error: "معرف الكتاب مفقود." },
        { status: 200 }
      );
    }

    await finalizeBookIfDone(bookId);
    return NextResponse.json({ bookId, status: "checked" });
  } catch (error) {
    console.error("[Books] Finalize failed", error);
    return NextResponse.json(
      { error: "تعذر التحقق من الكتاب." },
      { status: 502 }
    );
  }
}
