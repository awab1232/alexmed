"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { putFileWithProgress } from "@/lib/upload-client";
import { errorFromResponseBody } from "@/components/billing/UpgradePrompt";
import s from "@/components/doctor-sets/doctorSets.module.css";
import SetSettingsFields, {
  EMPTY_SETTINGS,
  settingsPayload,
} from "@/components/doctor-sets/SetSettingsFields";

type Stage = "idle" | "uploading" | "creating";

// New protected set. The PDF goes up exactly the way every question file
// does (/api/books/upload-url → direct PUT to storage), then
// doctor.sets.create starts the SAME question-file pipeline — extraction,
// images, explanations — once. Students never trigger any of it.
export default function NewQuestionSetPage() {
  const router = useRouter();
  const create = trpc.doctor.sets.create.useMutation();
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function submit() {
    if (!file) {
      setError("اختر ملف الأسئلة (PDF).");
      return;
    }
    setError("");
    setStage("uploading");
    setProgress(0);
    try {
      const response = await fetch("/api/books/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: "application/pdf",
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw errorFromResponseBody(data, "تعذر تجهيز رابط الرفع.");
      await putFileWithProgress(
        data.uploadUrl,
        file,
        "application/pdf",
        setProgress
      );
      setStage("creating");
      const { setId } = await create.mutateAsync({
        ...settingsPayload(settings),
        key: data.key,
        fileName: file.name,
      });
      router.push(`/doctor/sets/${setId}`);
    } catch (caught) {
      setStage("idle");
      setError(
        caught instanceof Error ? caught.message : "تعذر إنشاء المجموعة."
      );
    }
  }

  const busy = stage !== "idle";

  return (
    <section className="upload-view">
      <div className={s.page}>
        <header className={s.header}>
          <Link href="/doctor" className={s.back}>
            ‹ لوحة الدكتور
          </Link>
          <h1>مجموعة أسئلة جديدة</h1>
          <p>
            الملف يُعالج مرة واحدة بنفس نظام ملفات الأسئلة. تراجع الأسئلة، ثم
            تنشر وتولّد الأكواد.
          </p>
        </header>

        <form
          className={s.form}
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          <SetSettingsFields
            value={settings}
            onChange={setSettings}
            idPrefix="new-set"
          />

          <label className={s.field} htmlFor="new-set-file">
            ملف الأسئلة (PDF)
            <input
              id="new-set-file"
              type="file"
              accept="application/pdf,.pdf"
              required
              disabled={busy}
              onChange={event => setFile(event.target.files?.[0] ?? null)}
            />
            <small>
              ملف نصي أو ممسوح ضوئيًا — الصفحات المصوّرة تُقرأ بالقراءة الضوئية
              وتأخذ وقتًا أطول قليلًا. يُحتسب الملف من حصة ملفات الأسئلة في
              باقتك.
            </small>
          </label>

          {error ? (
            <p className={s.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={s.actions}>
            <button type="submit" className="nl-marker-button" disabled={busy}>
              {busy ? (
                <Loader2 size={16} className="spin" aria-hidden="true" />
              ) : (
                <FileUp size={16} aria-hidden="true" />
              )}
              {stage === "uploading"
                ? `جاري الرفع ${progress}%`
                : stage === "creating"
                  ? "جاري بدء المعالجة..."
                  : "ارفع وأنشئ المجموعة"}
            </button>
            <Link href="/doctor" className="secondary-button">
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
