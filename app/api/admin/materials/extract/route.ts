import {
  finalizeAdminMaterialExtraction,
  getAdminMaterialById,
  markAdminMaterialExtractionFailed,
  updateAdminMaterialExtractionProgress,
  type AdminMaterialPageText,
} from "@/lib/db-admin-materials";
import { findMissingPageNumbers, normalizePageText } from "@/lib/pdf-cards";
import { ocrPages } from "@/lib/pdf-ocr";
import { publishMessage } from "@/lib/queue/client";
import { storageGetSignedUrl } from "@/lib/storage";
import { verifyQStashRequest } from "@/lib/queue/verify";
import { NextResponse } from "next/server";
// Must be imported before "pdf-parse" — see app/api/pdf/extract/route.ts for why.
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

// Processes at most one OCR batch per invocation, then self-chains — same
// reasoning as app/api/mirror/extract/route.ts, which this file mirrors
// closely (see that file's comment for the full design).
const OCR_BATCH_SIZE = 12;

// مكتبة الأدمن's counterpart to app/api/mirror/extract/route.ts — an admin's
// uploaded PDF goes through the exact same extraction+OCR pipeline as a
// student's مِرآة upload. Unlike مِرآة, the material's status stays
// "processing" through both this extraction phase and the generation phase
// that follows (see finalizeAdminMaterialExtraction) — there's no separate
// "extracting" state in the admin lifecycle.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("upstash-signature");
  const verified = await verifyQStashRequest(rawBody, signature, request);
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let materialId: string;
  let material: Awaited<ReturnType<typeof getAdminMaterialById>>;
  try {
    const body = JSON.parse(rawBody) as { materialId?: string };
    materialId = typeof body.materialId === "string" ? body.materialId : "";
    if (!materialId) {
      return NextResponse.json(
        { error: "معرف المادة مفقود." },
        { status: 200 }
      );
    }

    material = await getAdminMaterialById(materialId);
    if (!material) {
      return NextResponse.json({ materialId, status: "skipped" });
    }
    if (material.status !== "processing") {
      return NextResponse.json({ materialId, status: "already_done" });
    }
  } catch (error) {
    console.error("[AdminMaterials] Extraction lookup failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز هذه المادة." },
      { status: 502 }
    );
  }

  let parser: PDFParse | undefined;
  try {
    const signedGetUrl = await storageGetSignedUrl(material.fileKey);
    parser = new PDFParse({ url: signedGetUrl, CanvasFactory });

    let pages: AdminMaterialPageText[];
    let pagesNeedingOcr: number[];
    let ocrFailedPages: number[];
    let totalPages: number;

    if (!material.pageTexts) {
      const result = await parser.getText();
      pages = result.pages.map(page => {
        const text = normalizePageText(page.text);
        return { page: page.num, text, hasText: text.length > 0 };
      });
      totalPages = result.total;

      if (!pages.length) {
        await markAdminMaterialExtractionFailed(
          materialId,
          "تعذر قراءة أي صفحة من هذا الملف."
        );
        return NextResponse.json({ materialId, status: "failed" });
      }

      pagesNeedingOcr = pages
        .filter(page => !page.hasText)
        .map(page => page.page);
      ocrFailedPages = [];
      await updateAdminMaterialExtractionProgress(materialId, {
        pageCount: totalPages,
        pageTexts: pages,
        pagesNeedingOcr,
        ocrFailedPages,
      });
    } else {
      pages = material.pageTexts;
      pagesNeedingOcr = material.pagesNeedingOcr ?? [];
      ocrFailedPages = material.ocrFailedPages ?? [];
      totalPages = material.pageCount;
    }

    if (pagesNeedingOcr.length) {
      const batch = pagesNeedingOcr.slice(0, OCR_BATCH_SIZE);
      const { pages: ocrResults, failedPages } = await ocrPages(parser, batch);
      const ocrByPage = new Map(ocrResults.map(page => [page.page, page]));
      pages = pages.map(page => {
        const ocrResult = ocrByPage.get(page.page);
        return ocrResult
          ? {
              page: page.page,
              text: ocrResult.text,
              hasText: ocrResult.hasText,
            }
          : page;
      });
      const remainingOcr = pagesNeedingOcr.slice(OCR_BATCH_SIZE);
      ocrFailedPages = [...ocrFailedPages, ...failedPages];

      await updateAdminMaterialExtractionProgress(materialId, {
        pageTexts: pages,
        pagesNeedingOcr: remainingOcr,
        ocrFailedPages,
      });

      if (remainingOcr.length) {
        await publishMessage(
          { type: "extract_admin_material", materialId },
          {
            flowControl: {
              key: `admin-material-extract-${materialId}`,
              parallelism: 1,
            },
          }
        );
        return NextResponse.json({
          materialId,
          status: "extracting",
          remaining: remainingOcr.length,
        });
      }
    }

    // A page left with no text after OCR is treated as image-only content
    // (nothing to transcribe), not a failure — only a page missing outright
    // or one whose OCR call actually errored blocks extraction.
    const missingPages = findMissingPageNumbers(pages, totalPages);
    if (missingPages.length || ocrFailedPages.length) {
      const pagesToRetry = Array.from(
        new Set([...missingPages, ...ocrFailedPages])
      ).sort((a, b) => a - b);
      await markAdminMaterialExtractionFailed(
        materialId,
        `لم نتمكن من قراءة كل صفحات الملف. الصفحات التي تحتاج إعادة معالجة: ${pagesToRetry.join(", ")}`
      );
      return NextResponse.json({
        materialId,
        status: "failed",
        pages: pagesToRetry,
      });
    }

    const { batches } = await finalizeAdminMaterialExtraction(
      materialId,
      pages
    );

    try {
      await Promise.all(
        batches.map(batch =>
          publishMessage({
            type: "generate_admin_material_batch",
            batchId: batch.id,
            materialId,
          })
        )
      );
    } catch (publishError) {
      console.error(
        "[AdminMaterials] Failed to enqueue batches after extraction",
        publishError
      );
      return NextResponse.json(
        { error: "تعذر بدء توليد البطاقات." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      materialId,
      status: "extracted",
      batchCount: batches.length,
    });
  } catch (error) {
    console.error("[AdminMaterials] Extraction failed", error);
    return NextResponse.json(
      { error: "تعذر قراءة الملف أو تجهيزه." },
      { status: 502 }
    );
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}
