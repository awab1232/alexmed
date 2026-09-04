"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Loader2,
  Upload as UploadIcon,
  X,
} from "lucide-react";

type ChapterProgress = {
  id: string;
  title: string;
  status: "pending" | "analyzing" | "complete" | "failed";
};

type Stage = "idle" | "uploading" | "planning" | "analyzing" | "done";

const RATE_LIMIT_MAX_RETRIES = 3;
const BATCH_RETRY_MAX_RETRIES = 2;
const BATCH_RETRY_DELAY_MS = 4000;
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BookUploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [bookId, setBookId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterProgress[]>([]);
  const [dragActive, setDragActive] = useState(false);

  function chooseFile(nextFile: File | undefined) {
    setError("");
    if (!nextFile) return;
    if (
      nextFile.type !== "application/pdf" &&
      !nextFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("اختَر ملف PDF فقط.");
      return;
    }
    setFile(nextFile);
  }

  async function analyzeChapter(chapterId: string): Promise<boolean> {
    for (let attempt = 0; ; attempt++) {
      let response: Response | null = null;
      let data: { error?: string; retryAfterMs?: number } | null = null;
      try {
        response = await fetch("/api/books/analyze-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId }),
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
        setWarning(
          isRateLimited
            ? `تجاوزنا الحد المؤقت لمزوّد الذكاء الاصطناعي — ننتظر ${Math.ceil(waitMs / 1000)} ثانية...`
            : `تعذر تحليل هذا الفصل، جارٍ إعادة المحاولة...`
        );
        await sleep(waitMs);
        continue;
      }

      return false;
    }
  }

  async function startProcessing() {
    if (!file) return;
    setError("");
    setWarning("");
    setStage("uploading");

    try {
      const uploadUrlResponse = await fetch("/api/books/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "application/pdf",
        }),
      });
      const uploadUrlData = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok)
        throw new Error(uploadUrlData.error || "تعذر تجهيز رابط الرفع.");

      const putResponse = await fetch(uploadUrlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!putResponse.ok)
        throw new Error(
          "تعذر رفع الملف للتخزين. تحقق من الاتصال وحاول مرة أخرى."
        );

      setStage("planning");
      const planResponse = await fetch("/api/books/extract-and-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: uploadUrlData.key, fileName: file.name }),
      });
      const planData = await planResponse.json();
      if (!planResponse.ok)
        throw new Error(
          planData.error || "تعذر قراءة الملف أو تقسيمه إلى فصول."
        );

      const plannedChapters: ChapterProgress[] = planData.chapters.map(
        (chapter: { id: string; title: string }) => ({
          id: chapter.id,
          title: chapter.title,
          status: "pending" as const,
        })
      );
      setBookId(planData.bookId);
      setChapters(plannedChapters);
      setStage("analyzing");

      for (const chapter of plannedChapters) {
        setChapters(previous =>
          previous.map(c =>
            c.id === chapter.id ? { ...c, status: "analyzing" } : c
          )
        );
        const ok = await analyzeChapter(chapter.id);
        setWarning("");
        setChapters(previous =>
          previous.map(c =>
            c.id === chapter.id
              ? { ...c, status: ok ? "complete" : "failed" }
              : c
          )
        );
      }

      setStage("done");
    } catch (processingError) {
      setStage(bookId ? "analyzing" : "idle");
      setError(
        processingError instanceof Error
          ? processingError.message
          : "حدث خطأ غير متوقع."
      );
    }
  }

  const isProcessing =
    stage === "uploading" || stage === "planning" || stage === "analyzing";
  const completeCount = chapters.filter(c => c.status === "complete").length;
  const failedCount = chapters.filter(c => c.status === "failed").length;

  return (
    <section className="upload-view">
      <div className="intro-grid">
        <div className="intro-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> رفع كتاب جديد
          </div>
          <h1>
            ارفع كتابك،
            <br />
            <em>واحنا نتكفّل بالباقي.</em>
          </h1>
          <p className="intro-lede">
            مهما كان حجم الكتاب — ٥٠ أو ٣٠٠ صفحة — هنقسّمه لك تلقائيًا لفصول
            صغيرة، ونحلّل كل فصل على حدة.
          </p>
        </div>
      </div>

      <div className="workspace-grid">
        <div className="upload-card panel-card">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">٠١ / الملف</span>
              <h2>اختر كتابك</h2>
            </div>
            <FileText size={23} className="heading-icon" />
          </div>

          {stage === "idle" && (
            <div
              className={dragActive ? "drop-zone drag-active" : "drop-zone"}
              onDragOver={event => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={event => {
                event.preventDefault();
                setDragActive(false);
                chooseFile(event.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={event => chooseFile(event.target.files?.[0])}
              />
              <div className="upload-icon">
                <UploadIcon size={23} />
              </div>
              <strong>{file ? file.name : "اسحب الكتاب إلى هنا"}</strong>
              <span>
                {file
                  ? `${formatBytes(file.size)} · جاهز للرفع`
                  : "أو اضغط لاختيار ملف من جهازك"}
              </span>
              {!file && <small>ملفات PDF فقط، حتى ٢٥٠ ميجابايت</small>}
            </div>
          )}

          {file && stage === "idle" && (
            <div className="selected-file">
              <div className="selected-file-icon">
                <FileText size={18} />
              </div>
              <div>
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)} · PDF</span>
              </div>
              <button
                aria-label="إزالة الملف"
                onClick={event => {
                  event.stopPropagation();
                  setFile(null);
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="inline-alert error">
              <CircleAlert size={16} />
              {error}
            </div>
          )}
          {warning && (
            <div className="inline-alert warning">
              <CircleAlert size={16} />
              {warning}
            </div>
          )}

          {(stage === "uploading" || stage === "planning") && (
            <div className="live-progress" role="status" aria-live="polite">
              <div className="progress-heading">
                <div className="progress-orbit">
                  <Loader2 size={17} className="spin" />
                </div>
                <div>
                  <strong>
                    {stage === "uploading"
                      ? "جاري رفع الملف"
                      : "نقرأ الكتاب ونقسّمه لفصول"}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {chapters.length > 0 && (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, color: "#8a9493" }}>
                {stage === "done"
                  ? `تم تحليل ${completeCount} من ${chapters.length} فصل${failedCount ? ` (تعذر تحليل ${failedCount})` : ""}`
                  : `تم تحليل ${completeCount} من ${chapters.length} فصل`}
              </div>
              <div className="progress-track">
                <i
                  style={{
                    width: `${(completeCount / chapters.length) * 100}%`,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {chapters.map(chapter => (
                  <div
                    key={chapter.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 12,
                    }}
                  >
                    {chapter.status === "complete" && (
                      <CheckCircle2 size={16} color="#5d9b78" />
                    )}
                    {chapter.status === "failed" && (
                      <CircleAlert size={16} color="#c8544d" />
                    )}
                    {chapter.status === "analyzing" && (
                      <Loader2 size={16} className="spin" color="#da774c" />
                    )}
                    {chapter.status === "pending" && (
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border: "2px solid #d8d1c7",
                          display: "inline-block",
                        }}
                      />
                    )}
                    <span>{chapter.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === "done" && bookId && (
            <button
              className="primary-button"
              style={{ marginTop: 18 }}
              onClick={() => router.push(`/books/${bookId}`)}
            >
              فتح الكتاب
            </button>
          )}

          {stage === "idle" && (
            <button
              className="primary-button"
              style={{ marginTop: 18 }}
              disabled={!file}
              onClick={startProcessing}
            >
              حوّل إلى فصول
            </button>
          )}

          {isProcessing && (
            <p style={{ marginTop: 12, fontSize: 11, color: "#8a9493" }}>
              تقدر تسكّر الصفحة وترجع بعدين — مش هنفقد أي تقدم، وهيكمل من الفصل
              اللي وقفت عنده.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
