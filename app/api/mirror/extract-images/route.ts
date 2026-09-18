import {
  getMirrorJobById,
  ensureMirrorImagePages,
  getNextPendingMirrorImagePage,
  insertMirrorPageImage,
  markMirrorImagePageComplete,
  markMirrorImagePageFailed,
} from "@/lib/db-mirror";
import {
  buildPageImageClassificationMessages,
  pageImageClassificationResponseSchema,
  parsePageImageClassification,
} from "@/lib/question-file-analysis";
import { invokeLLM, DEFAULT_VISION_MODEL } from "@/lib/llm";
import { claimMirrorImagePage } from "@/lib/queue/claim";
import { publishMessage } from "@/lib/queue/client";
import { storageGetSignedUrl, storagePut } from "@/lib/storage";
import { getScreenshotUnderLimit } from "@/lib/pdf-screenshot";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Multimodal مِرآة, additive image pass — entirely independent of and never
// blocking batch generation (published alongside it, once extraction
// succeeds — see app/api/mirror/extract/route.ts). Reuses the exact same
// page-classification builder/schema/parser as كتبي question-files' own
// image pipeline (lib/question-file-analysis.ts) — the "does this page
// contain a real figure" question has nothing question-file-specific about
// it. Self-chaining, same batch-size/claim/retry-budget shape as every
// other page-level worker in this app.
const PAGES_PER_INVOCATION = 12;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let jobId: string;
  try {
    const body = JSON.parse(rawBody) as { jobId?: string };
    jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (!jobId) {
      return NextResponse.json({ error: "معرف الملف مفقود." }, { status: 200 });
    }
  } catch (error) {
    console.error("[Mirror] Image body parse failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز صور هذا الملف." },
      { status: 502 }
    );
  }

  const job = await getMirrorJobById(jobId);
  if (!job) {
    return NextResponse.json({ jobId, status: "skipped" });
  }

  await ensureMirrorImagePages(jobId, job.pageCount);

  let parser: PDFParse | undefined;
  try {
    for (let i = 0; i < PAGES_PER_INVOCATION; i++) {
      const candidate = await getNextPendingMirrorImagePage(jobId);
      if (!candidate) break;

      const claimed = await claimMirrorImagePage(candidate.id);
      if (!claimed) continue; // lost the race to another delivery — move on

      try {
        if (!parser) {
          const signedGetUrl = await storageGetSignedUrl(job.fileKey);
          parser = new PDFParse({ url: signedGetUrl, CanvasFactory });
        }

        const shot = await getScreenshotUnderLimit(
          parser,
          candidate.pageNumber,
          { imageBuffer: true }
        );
        if (!shot?.dataUrl) {
          throw new Error("Page screenshot generation failed");
        }

        const response = await invokeLLM({
          model: DEFAULT_VISION_MODEL,
          max_tokens: 200,
          messages: buildPageImageClassificationMessages(
            candidate.pageNumber,
            shot.dataUrl
          ),
          response_format: pageImageClassificationResponseSchema,
        });
        const classification = parsePageImageClassification(
          response.choices[0]?.message.content
        );

        if (classification.hasImage && shot.data) {
          const { key: storageKey } = await storagePut(
            `mirror-pages/${jobId}/${candidate.pageNumber}.png`,
            shot.data,
            "image/png"
          );
          await insertMirrorPageImage(jobId, candidate.pageNumber, storageKey);
        }

        await markMirrorImagePageComplete(candidate.id);
      } catch (pageError) {
        console.error(
          `[Mirror] Page ${candidate.pageNumber} image classification failed`,
          pageError
        );
        await markMirrorImagePageFailed(
          candidate.id,
          "تعذر تحليل صور هذه الصفحة."
        );
      }
    }

    const remaining = await getNextPendingMirrorImagePage(jobId);
    if (remaining) {
      await publishMessage(
        { type: "extract_mirror_images", jobId },
        { flowControl: { key: `mirror-images-${jobId}`, parallelism: 1 } }
      );
      return NextResponse.json({ jobId, status: "processing" });
    }

    return NextResponse.json({ jobId, status: "images_done" });
  } catch (error) {
    console.error("[Mirror] Image pipeline failed", error);
    return NextResponse.json(
      { error: "تعذر تحليل صور هذا الملف." },
      { status: 502 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
