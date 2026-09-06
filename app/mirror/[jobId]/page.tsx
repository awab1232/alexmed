"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// Background generation now happens entirely server-side, driven by
// Upstash QStash workers (see app/api/mirror/generate-batch/route.ts) — this
// page's only job is to poll job/batch status and show simple aggregate
// progress. It never calls generate-batch itself, so closing the tab or
// losing connection never stops generation; reopening this page just
// resumes showing the same server-side progress.
const POLL_INTERVAL_MS = 3000;
const TERMINAL_JOB_STATUSES = new Set(["complete", "partial_failed", "failed"]);

export default function MirrorJobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const noRedirect = searchParams.get("noRedirect") === "1";
  const utils = trpc.useUtils();
  const jobQuery = trpc.mirror.get.useQuery(
    { id: jobId },
    {
      refetchInterval: query => {
        const status = query.state.data?.job.status;
        return status && TERMINAL_JOB_STATUSES.has(status)
          ? false
          : POLL_INTERVAL_MS;
      },
    }
  );
  const retryBatch = trpc.mirror.retryBatch.useMutation({
    onSuccess: () => utils.mirror.get.invalidate({ id: jobId }),
  });

  // The deck exists (and starts accepting cards) as soon as extraction
  // finishes — see finalizeMirrorJobExtraction in lib/db-mirror.ts — so once
  // the FIRST batch is ready, send the student straight into a live review
  // session instead of making them wait on this progress page for every
  // batch to finish (components/Home.tsx's deck view keeps polling for the
  // rest). Skipped when ?noRedirect=1 — used by the review view's "التفاصيل"
  // link, so a student checking progress/retrying a failed batch on purpose
  // isn't immediately bounced back to their session.
  useEffect(() => {
    if (noRedirect) return;
    const job = jobQuery.data?.job;
    const batches = jobQuery.data?.batches ?? [];
    const completeCount = batches.filter(b => b.status === "complete").length;
    if (job?.deckId && completeCount >= 1) {
      router.replace(`/?openDeck=${job.deckId}`);
    }
  }, [jobQuery.data, noRedirect, router]);

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
  const failedBatches = batches.filter(b => b.status === "failed");
  const isExtracting = job.status === "extracting";
  const isGenerating =
    !isExtracting &&
    job.status !== "complete" &&
    job.status !== "partial_failed" &&
    job.status !== "failed";

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

      {isExtracting && (
        <div className="live-progress">
          <div className="progress-heading">
            <div>
              <Loader2 size={16} className="spin" />
              <strong>نقرأ الملف ونجهّزه...</strong>
            </div>
          </div>
          <p className="progress-caption">
            قد يستغرق هذا وقتًا أطول قليلًا للملفات الممسوحة ضوئيًا. يمكنك إغلاق
            هذه الصفحة والعودة لاحقًا من أي جهاز دون فقدان التقدم.
          </p>
        </div>
      )}

      {isGenerating && (
        <div className="live-progress">
          <div className="progress-heading">
            <div>
              <Loader2 size={16} className="spin" />
              <strong>جاري تجهيز ملفك</strong>
            </div>
            <span>
              تم إكمال {completeCount} من {batches.length} جزءًا
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
            لا يتم اعتماد الملف حتى تكتمل جميع أجزائه. يمكنك إغلاق هذه الصفحة
            والعودة لاحقًا من أي جهاز دون فقدان التقدم.
          </p>
        </div>
      )}

      {job.status === "failed" && (
        <div className="inline-alert error wide">
          <CircleAlert size={16} />
          <span>
            {job.extractionError ||
              "تعذّرت قراءة هذا الملف. جرّب رفع نسخة أخرى منه."}
          </span>
          <Link
            href="/"
            className="secondary-button"
            style={{ marginRight: 12 }}
          >
            ارفع ملفًا جديدًا
          </Link>
        </div>
      )}

      {job.status === "complete" && (
        <div className="inline-alert success wide">
          <CheckCircle2 size={16} />
          {noRedirect
            ? "اكتمل التوليد."
            : "اكتمل التوليد — جاري نقلك لمكتبتك..."}
        </div>
      )}

      {job.status === "partial_failed" && (
        <div className="inline-alert warning wide">
          <CircleAlert size={16} />
          اكتمل معظم الملف، لكن {failedBatches.length} جزءًا تعذّر توليده. يمكنك
          إعادة محاولته أدناه.
        </div>
      )}

      {failedBatches.length > 0 && (
        <div className="library-grid">
          {failedBatches.map(batch => (
            <div className="library-item" key={batch.id}>
              <div className="library-item-icon">
                <CircleAlert size={18} />
              </div>
              <div className="library-item-meta">
                <strong>
                  صفحة {batch.startPage}–{batch.endPage}
                </strong>
                <span>{batch.errorMessage || "تعذّر التوليد"}</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={retryBatch.isPending}
                onClick={() => retryBatch.mutate({ batchId: batch.id })}
              >
                <RotateCcw size={14} /> إعادة المحاولة
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
