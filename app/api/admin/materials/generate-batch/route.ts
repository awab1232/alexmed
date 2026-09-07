import { AiRateLimitError } from "@/lib/ai/types";
import {
  completeAdminMaterialBatchGeneration,
  finalizeAdminMaterialIfDone,
  getAdminMaterialBatchById,
  markAdminMaterialBatchFailedTerminal,
  markAdminMaterialBatchRetrying,
} from "@/lib/db-admin-materials";
import { invokeLLM } from "@/lib/llm";
import {
  buildGenerateMessages,
  GENERATE_MAX_TOKENS,
  GeneratedCard,
  parseJsonResponse,
  responseSchema,
} from "@/lib/pdf-cards";
import { isUserConcurrencyExceeded } from "@/lib/queue/concurrency";
import { claimAdminMaterialBatch } from "@/lib/queue/claim";
import { getQueueMaxAttempts } from "@/lib/queue/types";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminMaterials } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

// Vercel Hobby's hard ceiling for a serverless function is 60s regardless of
// this value.
export const maxDuration = 60;

// مكتبة الأدمن's counterpart to app/api/mirror/generate-batch/route.ts — same
// "same quality/logic as مِرآة" requirement, so this reuses lib/pdf-cards.ts's
// buildGenerateMessages/responseSchema/parseJsonResponse verbatim, and the
// same retryOrFail/sourcePage-rejection pattern. Invoked only by QStash,
// verified via signature below.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let batchId: string;
  let batch: Awaited<ReturnType<typeof getAdminMaterialBatchById>>;
  let ownerAdminId: string | null = null;
  let claimed: Awaited<ReturnType<typeof claimAdminMaterialBatch>>;
  try {
    const body = JSON.parse(rawBody) as { batchId?: string };
    batchId = typeof body.batchId === "string" ? body.batchId : "";
    if (!batchId) {
      return NextResponse.json(
        { error: "معرف الدفعة مفقود." },
        { status: 200 }
      );
    }

    batch = await getAdminMaterialBatchById(batchId);
    if (!batch) {
      return NextResponse.json({ batchId, status: "skipped" });
    }

    const db = getDb();
    if (db) {
      const [material] = await db
        .select({ ownerAdminId: adminMaterials.ownerAdminId })
        .from(adminMaterials)
        .where(eq(adminMaterials.id, batch.materialId))
        .limit(1);
      ownerAdminId = material?.ownerAdminId ?? null;
    }

    if (
      ownerAdminId &&
      (await isUserConcurrencyExceeded(ownerAdminId, "admin_materials"))
    ) {
      return NextResponse.json(
        { batchId, status: "throttled" },
        { status: 429 }
      );
    }

    claimed = await claimAdminMaterialBatch(batchId);
    if (!claimed) {
      return NextResponse.json({ batchId, status: "already_processing" });
    }
  } catch (error) {
    console.error("[AdminMaterials] Batch lookup/claim failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذه الدفعة." },
      { status: 502 }
    );
  }

  const pages = (batch.pageTexts ?? []).filter(page => page.hasText);
  if (!pages.length) {
    await completeAdminMaterialBatchGeneration(batchId, batch.materialId, []);
    await finalizeAdminMaterialIfDone(batch.materialId);
    return NextResponse.json({ batchId, status: "complete", cards: [] });
  }

  const maxAttempts = getQueueMaxAttempts();

  async function retryOrFail(errorMessage: string, httpStatus: number) {
    if (claimed!.attemptCount >= maxAttempts) {
      await markAdminMaterialBatchFailedTerminal(batchId, errorMessage);
      await finalizeAdminMaterialIfDone(batch!.materialId);
      return NextResponse.json({
        batchId,
        status: "failed",
        error: errorMessage,
      });
    }
    await markAdminMaterialBatchRetrying(batchId, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: httpStatus });
  }

  try {
    const response = await invokeLLM({
      max_tokens: GENERATE_MAX_TOKENS,
      // Admin materials don't have a مِرآة-style "depth" (quick/balanced/
      // detailed) input — "balanced" is a reasonable, neutral default that
      // matches مِرآة's own default.
      messages: buildGenerateMessages(pages, "balanced"),
      response_format: responseSchema,
    });

    const parsed = parseJsonResponse(response.choices[0]?.message.content);
    const cards: GeneratedCard[] = Array.isArray(parsed.cards)
      ? parsed.cards.filter((card: GeneratedCard) =>
          pages.some(page => page.page === card.sourcePage)
        )
      : [];

    if (!cards.length) {
      return await retryOrFail(
        "لم يتم العثور على أسئلة قابلة للتحويل إلى بطاقات في هذه الدفعة.",
        422
      );
    }

    await completeAdminMaterialBatchGeneration(
      batchId,
      batch.materialId,
      cards
    );
    await finalizeAdminMaterialIfDone(batch.materialId);

    return NextResponse.json({ batchId, status: "complete", cards });
  } catch (error) {
    console.error("[AdminMaterials] Batch generation failed", error);
    if (error instanceof AiRateLimitError) {
      if (claimed.attemptCount >= maxAttempts) {
        await markAdminMaterialBatchFailedTerminal(
          batchId,
          "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي."
        );
        await finalizeAdminMaterialIfDone(batch.materialId);
        return NextResponse.json({ batchId, status: "failed" });
      }
      await markAdminMaterialBatchRetrying(
        batchId,
        "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي."
      );
      return NextResponse.json(
        { error: "تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي." },
        { status: 429 }
      );
    }
    return await retryOrFail("تعذر توليد بطاقات لهذه الدفعة.", 502);
  }
}
