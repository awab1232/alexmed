"use client";

import { ChevronRight, Play, RotateCcw } from "lucide-react";
import type { StageResult } from "@/lib/db-brain-games";
import NiroCharacter from "@/components/niro/NiroCharacter";
import { niroLine } from "@/lib/niro";

function seconds(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} ث`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// 🎉 Stage Complete / Almost there — only ever shows the server's verdict.
export default function StageResultView({
  result,
  kind,
  totalStages,
  onNext,
  onRetry,
  onBack,
}: {
  result: StageResult;
  kind: "quiz" | "sudoku";
  totalStages: number;
  onNext: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const passed = result.passed;
  const lastStage = result.stage >= totalStages;
  return (
    <div
      className={`bg-result ${passed ? "is-pass" : "is-fail"}`}
      role="status"
      aria-live="polite"
    >
      <NiroCharacter
        className="bg-result-niro"
        expression={passed ? "victory" : "challenge"}
        size={128}
        animated
      />
      <h2>
        {passed
          ? lastStage
            ? "كل المستويات مكتملة!"
            : `أنهيت المستوى ${result.stage}`
          : "قربت! 💪"}
      </h2>
      <p className="bg-result-niro-line">
        {niroLine(
          passed ? (lastStage ? "allDone" : "levelUp") : "almost",
          result.stage
        )}
      </p>
      {!passed && kind === "quiz" && (
        <p className="bg-result-sub">
          <bdi dir="ltr">
            {result.correct}/{result.total}
          </bdi>{" "}
          — تحتاج أكثر قليلًا لفتح المستوى التالية
        </p>
      )}

      <dl className="bg-result-stats">
        <div>
          <dt>النتيجة</dt>
          <dd>{result.score.toLocaleString("en")}</dd>
        </div>
        {kind === "quiz" ? (
          <>
            <div>
              <dt>الصحيح</dt>
              <dd>
                {result.correct}/{result.total}
              </dd>
            </div>
            <div>
              <dt>الدقة</dt>
              <dd>{result.accuracy}%</dd>
            </div>
            <div>
              <dt>أسرع إجابة</dt>
              <dd>{seconds(result.fastestMs)}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>الوقت</dt>
              <dd>{seconds(result.timeMs)}</dd>
            </div>
            <div>
              <dt>التلميحات</dt>
              <dd>{result.hintsUsed ?? 0}</dd>
            </div>
          </>
        )}
        <div>
          <dt>أفضل نتيجة</dt>
          <dd>{result.bestScore.toLocaleString("en")}</dd>
        </div>
      </dl>

      {result.newBest && (
        <p className="bg-result-best">⭐ رقم قياسي جديد لهذا المستوى!</p>
      )}
      {result.unlockedStage && (
        <p className="bg-result-unlock">
          🔓 انفتح المستوى {result.unlockedStage}
        </p>
      )}

      <div className="bg-result-actions">
        {passed && result.nextStage && (
          <button type="button" className="bg-primary-lg" onClick={onNext}>
            <Play size={18} aria-hidden="true" /> المستوى التالي
          </button>
        )}
        <button type="button" className="secondary-button" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" />
          {passed ? "أعد المحاولة" : "حاول مرة ثانية"}
        </button>
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronRight size={16} aria-hidden="true" /> العودة للألعاب
        </button>
      </div>
    </div>
  );
}
