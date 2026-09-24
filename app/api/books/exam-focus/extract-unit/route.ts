import {
  allExamFocusUnitsSettled,
  claimExamFocusUnit,
  completeExamFocusUnit,
  countProcessingExamFocusUnitsForUser,
  getExamFocusUnitForWorker,
  markExamFocusUnit,
} from "@/lib/db-exam-focus";
import { extractExamFocusUnit, type ExamFocusLlm } from "@/lib/exam-focus";
import { invokeLLM } from "@/lib/llm";
import { publishMessage } from "@/lib/queue/client";
import {
  getExamFocusPerUserConcurrency,
  getQueueMaxAttempts,
} from "@/lib/queue/types";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";

// 🔥 Exam Focus worker: extracts the high-yield facts of ONE unit (a page
// range of the file) — see lib/exam-focus.ts. Invoked only by QStash
// (signature-verified). Each unit retries on its own; one failing unit
// never restarts the book. When the last unit settles, finalize is queued.
export const maxDuration = 300;

// Re-check interval while this student's other units hold every slot.
const WAITING_FOR_SLOT_DELAY_SECONDS = 20;

function retryDelaySeconds(attemptCount: number) {
  return Math.min(10 * 3 ** Math.max(0, attemptCount - 1), 300);
}

const llm: ExamFocusLlm = params => invokeLLM(params);

async function queueFinalizeIfSettled(deckId: string) {
  if (await allExamFocusUnitsSettled(deckId)) {
    await publishMessage({ type: "finalize_exam_focus", deckId });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let unitId = "";
  let row: Awaited<ReturnType<typeof getExamFocusUnitForWorker>>;
  let claimed: Awaited<ReturnType<typeof claimExamFocusUnit>>;
  try {
    const body = JSON.parse(rawBody) as { unitId?: string };
    unitId = typeof body.unitId === "string" ? body.unitId : "";
    if (!unitId) {
      return NextResponse.json({ error: "missing unitId" }, { status: 200 });
    }
    row = await getExamFocusUnitForWorker(unitId);
    // Deleted (book removed, or the student regenerated the deck) — an old
    // message for it is simply dropped.
    if (!row) return NextResponse.json({ unitId, status: "skipped" });

    // Per-student fairness: wait (own delayed message, not a 429 that
    // burns QStash's short retry budget) while this student's other units
    // hold every slot.
    if (
      (await countProcessingExamFocusUnitsForUser(row.userId)) >=
      getExamFocusPerUserConcurrency()
    ) {
      await publishMessage(
        {
          type: "extract_exam_focus_unit",
          unitId,
          deckId: row.unit.deckId,
        },
        { delay: WAITING_FOR_SLOT_DELAY_SECONDS }
      );
      return NextResponse.json({ unitId, status: "throttled" });
    }

    claimed = await claimExamFocusUnit(unitId);
    if (!claimed) {
      return NextResponse.json({ unitId, status: "already_processing" });
    }
  } catch (error) {
    console.error("[ExamFocus] unit lookup/claim failed", error);
    return NextResponse.json({ error: "claim failed" }, { status: 502 });
  }

  const { unit } = row;
  try {
    const result = await extractExamFocusUnit({
      fileName: row.fileName,
      unitIndex: unit.unitIndex,
      totalUnits: row.totalUnits,
      pageTexts: unit.pageTexts,
      llm,
    });
    await completeExamFocusUnit(
      unitId,
      result.facts,
      result.declaredEmptyPages
    );
    await queueFinalizeIfSettled(unit.deckId);
    return NextResponse.json({
      unitId,
      status: "complete",
      facts: result.facts.length,
      uncoveredPages: result.uncoveredPages,
    });
  } catch (error) {
    console.error("[ExamFocus] unit extraction failed", error);
    const message = `تعذر تحليل الصفحات ${unit.pageStart}–${unit.pageEnd}.`;
    if (claimed.attemptCount >= getQueueMaxAttempts()) {
      // Out of attempts: recorded as failed (shown to the student with a
      // retry button and reported in coverage) — never silently "done".
      await markExamFocusUnit(unitId, "failed", message);
      await queueFinalizeIfSettled(unit.deckId);
      return NextResponse.json({ unitId, status: "failed" });
    }
    await markExamFocusUnit(unitId, "retrying", message);
    try {
      // Self-scheduled retry of just this unit (see analyze-chapter for why
      // not QStash's own retry: its budget can run out with nothing queued).
      await publishMessage(
        { type: "extract_exam_focus_unit", unitId, deckId: unit.deckId },
        { delay: retryDelaySeconds(claimed.attemptCount) }
      );
      return NextResponse.json({ unitId, status: "retry_scheduled" });
    } catch (publishError) {
      console.error("[ExamFocus] failed to schedule retry", publishError);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
}
