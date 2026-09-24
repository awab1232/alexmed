"use client";

import { CheckCircle2, Circle, CircleAlert, Loader2 } from "lucide-react";

type UnitProgress = {
  id: string;
  pageStart: number;
  pageEnd: number;
  status: string;
  factCount: number;
};

type StageState = "done" | "active" | "pending" | "failed";

function StageIcon({ state }: { state: StageState }) {
  if (state === "done") return <CheckCircle2 size={17} aria-hidden="true" />;
  if (state === "active") {
    return <Loader2 size={17} className="spin" aria-hidden="true" />;
  }
  if (state === "failed") return <CircleAlert size={17} aria-hidden="true" />;
  return <Circle size={17} aria-hidden="true" />;
}

const STATE_TEXT: Record<StageState, string> = {
  done: "تم",
  active: "جارٍ",
  pending: "بانتظار",
  failed: "فشل",
};

// Real pipeline progress for Exam Focus — every row maps to an actual
// server-side step (units = page ranges analysed by the queue workers;
// the last three run in the finalize job), never a fake timer.
export default function ExamFocusProgress({
  deckStatus,
  units,
}: {
  deckStatus: string;
  units: UnitProgress[];
}) {
  const settled = units.filter(
    unit => unit.status === "complete" || unit.status === "failed"
  ).length;
  const failed = units.filter(unit => unit.status === "failed").length;
  const facts = units.reduce((sum, unit) => sum + unit.factCount, 0);
  const allSettled = settled === units.length;
  const finalizing = deckStatus === "finalizing";
  const percent = units.length ? Math.round((settled / units.length) * 100) : 0;

  const stages: { label: string; detail?: string; state: StageState }[] = [
    {
      label: "تحليل كل صفحات الملف",
      detail: `${settled}/${units.length} جزء`,
      state: allSettled ? (failed ? "failed" : "done") : "active",
    },
    {
      label: "استخراج المعلومات عالية الأهمية",
      detail: `${facts} معلومة`,
      state: allSettled ? "done" : facts ? "active" : "pending",
    },
    { label: "إزالة التكرار", state: finalizing ? "active" : "pending" },
    {
      label: "بناء بطاقات Exam Focus",
      state: finalizing ? "active" : "pending",
    },
    {
      label: "التحقق من تغطية الملف كاملًا",
      state: finalizing ? "active" : "pending",
    },
  ];

  return (
    <div className="ef-progress" aria-live="polite">
      <div className="ef-progress-hero">
        <span className="ef-progress-flame" aria-hidden="true">
          🔥
        </span>
        <h2>⏳ نحلل ملفك كاملًا…</h2>
        <p>
          نقرأ كل الصفحات من أولها لآخرها ونستخرج المعلومات المهمة للامتحان.
          تقدر تسكّر الصفحة وترجع، الشغل مستمر على السيرفر.
        </p>
        <div
          className="ef-progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="نسبة التحليل"
        >
          <span style={{ width: `${Math.max(4, percent)}%` }} />
        </div>
      </div>

      <ol className="ef-stages">
        {stages.map(stage => (
          <li key={stage.label} className={`is-${stage.state}`}>
            <StageIcon state={stage.state} />
            <span>{stage.label}</span>
            {stage.detail && <small>{stage.detail}</small>}
            <span className="sr-only">{STATE_TEXT[stage.state]}</span>
          </li>
        ))}
      </ol>

      <div className="ef-units" aria-label="أجزاء الملف">
        {units.map(unit => {
          const state: StageState =
            unit.status === "complete"
              ? "done"
              : unit.status === "failed"
                ? "failed"
                : unit.status === "processing" || unit.status === "retrying"
                  ? "active"
                  : "pending";
          return (
            <span key={unit.id} className={`ef-unit is-${state}`}>
              <StageIcon state={state} />ص {unit.pageStart}–{unit.pageEnd}
              <span className="sr-only">{STATE_TEXT[state]}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
