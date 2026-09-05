"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const RATE_LIMIT_MAX_RETRIES = 3;
const BATCH_RETRY_MAX_RETRIES = 2;
const BATCH_RETRY_DELAY_MS = 4000;
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

async function generateBatch(batchId: string): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null;
    let data: { error?: string; retryAfterMs?: number } | null = null;
    try {
      response = await fetch("/api/mirror/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      data = await response.json();
    } catch {
      // falls through to the retry policy below, same as a non-ok response
    }

    if (response?.ok) return true;

    const isRateLimited = response?.status === 429;
    const canRetry = isRateLimited
      ? attempt < RATE_LIMIT_MAX_RETRIES
      : attempt < BATCH_RETRY_MAX_RETRIES;

    if (canRetry) {
      const waitMs = isRateLimited
        ? typeof data?.retryAfterMs === "number"
          ? data.retryAfterMs
          : 20_000
        : BATCH_RETRY_DELAY_MS;
      await sleep(waitMs);
      continue;
    }

    return false;
  }
}

export default function MirrorJobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const router = useRouter();
  const jobQuery = trpc.mirror.get.useQuery({ id: jobId });
  const utils = trpc.useUtils();
  const [warning, setWarning] = useState("");
  const resumingRef = useRef(false);

  // Resumability (Item D of the reliability plan, mirroring
  // app/books/[bookId]/page.tsx exactly): loading this page just re-queries
  // batch statuses — any "pending" or "failed" batch picks the loop back up
  // automatically, from any device, whether that's a fresh upload or the
  // student returning after closing the tab mid-generation.
  useEffect(() => {
    if (!jobQuery.data || resumingRef.current) return;
    const pending = jobQuery.data.batches.filter(
      batch => batch.status === "pending" || batch.status === "failed"
    );
    if (!pending.length) return;

    resumingRef.current = true;
    let cancelled = false;

    (async () => {
      let failedCount = 0;
      for (const batch of pending) {
        if (cancelled) break;
        const completed = await generateBatch(batch.id);
        if (!completed) failedCount += 1;
        if (!cancelled) await utils.mirror.get.invalidate({ id: jobId });
      }
      if (!cancelled) {
        setWarning(
          failedCount
            ? `تعذر إكمال ${failedCount} جزءًا من الملف. يمكنك إعادة المحاولة لاحقًا.`
            : ""
        );
      }
      resumingRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [jobQuery.data, jobId, utils]);

  // Once the job graduates (all batches complete → a real deck exists),
  // send the user straight to their library instead of leaving them on a
  // now-inert progress page.
  useEffect(() => {
    if (jobQuery.data?.job.status === "complete" && jobQuery.data.job.deckId) {
      router.replace(`/?openDeck=${jobQuery.data.job.deckId}`);
    }
  }, [jobQuery.data, router]);

  if (jobQuery.isLoading) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل الملف...</h3>
        </div>
      </section>
    );
  }

  if (!jobQuery.data) {
    return (
      <section className="upload-view">
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>تعذر العثور على هذا الملف</h3>
          <Link href="/" className="secondary-button" style={{ marginTop: 12 }}>
            العودة لمِرآة
          </Link>
        </div>
      </section>
    );
  }

  const { job, batches } = jobQuery.data;
  const completeCount = batches.filter(b => b.status === "complete").length;
  const isProcessing = batches.some(
    b => b.status === "pending" || b.status === "generating"
  );

  return (
    <section className="cards-view">
      <div className="cards-header">
        <div>
          <Link href="/" className="eyebrow" style={{ marginBottom: 8 }}>
            <span className="eyebrow-dot" /> ‹ رجوع لمِرآة
          </Link>
          <h1>{job.fileName}</h1>
          <p>
            {job.pageCount} صفحة · {batches.length} دفعة · {completeCount}/
            {batches.length} مكتملة
          </p>
        </div>
      </div>

      {isProcessing && !warning && (
        <div className="live-progress">
          <div className="progress-heading">
            <div>
              <Loader2 size={16} className="spin" />
              <strong>جاري تجهيز ملفك بالكامل</strong>
            </div>
            <span>
              تم تجهيز {completeCount} من {batches.length} جزءًا
            </span>
          </div>
          <div className="progress-track" aria-label="تقدم تجهيز الملف">
            <i
              style={{
                width: `${batches.length ? (completeCount / batches.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="progress-caption">
            لا يتم اعتماد الملف حتى تكتمل جميع أجزائه. يمكنك العودة لاحقًا
            لاستكمال ما تبقى.
          </p>
        </div>
      )}
      {job.status === "complete" && (
        <div className="inline-alert success wide">
          <CheckCircle2 size={16} />
          اكتمل التوليد — جاري نقلك لمكتبتك...
        </div>
      )}

      {warning && (
        <div className="inline-alert warning wide">
          <CircleAlert size={16} />
          {warning}
        </div>
      )}

      {batches.some(batch => batch.status === "failed") && (
        <details className="processing-details">
          <summary>عرض تفاصيل الأجزاء التي تحتاج إعادة محاولة</summary>
          <div className="library-grid">
            {batches
              .filter(batch => batch.status === "failed")
              .map(batch => (
                <div className="library-item" key={batch.id}>
                  <div className="library-item-icon">
                    <CircleAlert size={18} />
                  </div>
                  <div className="library-item-meta">
                    <strong>
                      صفحة {batch.startPage}–{batch.endPage}
                    </strong>
                    <span>{batch.errorMessage || "تحتاج إعادة محاولة"}</span>
                  </div>
                </div>
              ))}
          </div>
        </details>
      )}
    </section>
  );
}
