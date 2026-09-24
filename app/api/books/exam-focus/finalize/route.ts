import {
  claimExamFocusFinalize,
  getExamFocusUnitsForFinalize,
  releaseExamFocusFinalize,
  saveExamFocusDeck,
} from "@/lib/db-exam-focus";
import { composeExamFocusDeck } from "@/lib/exam-focus";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

// 🔥 Exam Focus finalize: once every unit is settled, takes the facts of ALL
// units → dedupe → order → coverage validation → persisted cards. No AI
// call, so it's fast and deterministic; the atomic claim makes duplicate
// deliveries harmless.
export const maxDuration = 60;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let deckId = "";
  let claimed = false;
  try {
    const body = JSON.parse(rawBody) as { deckId?: string };
    deckId = typeof body.deckId === "string" ? body.deckId : "";
    if (!deckId) {
      return NextResponse.json({ error: "missing deckId" }, { status: 200 });
    }
    const deck = await claimExamFocusFinalize(deckId);
    if (!deck) {
      // Units still running, already finalized, or deleted.
      return NextResponse.json({ deckId, status: "skipped" });
    }
    claimed = true;

    const units = await getExamFocusUnitsForFinalize(deckId);
    const { cards, coverage } = composeExamFocusDeck({
      totalPages: deck.totalPages,
      units: units.map(unit => ({
        ...unit,
        facts: unit.facts ?? [],
        declaredEmptyPages: unit.declaredEmptyPages ?? [],
      })),
    });
    const anyFailed = units.some(unit => unit.status === "failed");
    const status = !cards.length
      ? "failed"
      : anyFailed
        ? "partial_failed"
        : "complete";
    await saveExamFocusDeck({
      deckId,
      cards,
      coverage,
      status,
      errorMessage:
        status === "failed"
          ? anyFailed
            ? "تعذر تحليل الملف، حاول مرة أخرى."
            : "لم نجد معلومات امتحانية واضحة في هذا الملف."
          : anyFailed
            ? `تعذر تحليل ${coverage.failedRanges.length} جزء من الملف.`
            : null,
    });
    return NextResponse.json({
      deckId,
      status,
      cards: cards.length,
      coverage: coverage.status,
    });
  } catch (error) {
    console.error("[ExamFocus] finalize failed", error);
    // Hand the claim back so QStash's retry can take it straight away.
    if (claimed) {
      await releaseExamFocusFinalize(deckId).catch(releaseError =>
        console.error("[ExamFocus] release failed", releaseError)
      );
    }
    return NextResponse.json({ error: "finalize failed" }, { status: 502 });
  }
}
