"use client";

import { ChevronLeft, Play, RotateCcw } from "lucide-react";
import type { StageResult } from "@/lib/db-brain-games";

function seconds(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
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
      <span className="bg-result-emoji" aria-hidden="true">
        {passed ? (lastStage ? "🏆" : "🎉") : "💪"}
      </span>
      <h2>
        {passed
          ? lastStage
            ? "كل المراحل مكتملة!"
            : "Stage Complete"
          : "Almost there!"}
      </h2>
      {!passed && kind === "quiz" && (
        <p className="bg-result-sub">
          {result.correct} / {result.total} — تحتاج أكثر قليلًا لفتح المرحلة
          التالية
        </p>
      )}

      <dl className="bg-result-stats">
        <div>
          <dt>Score</dt>
          <dd>{result.score.toLocaleString("en")}</dd>
        </div>
        {kind === "quiz" ? (
          <>
            <div>
              <dt>Correct</dt>
              <dd>
                {result.correct}/{result.total}
              </dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{result.accuracy}%</dd>
            </div>
            <div>
              <dt>Fastest</dt>
              <dd>{seconds(result.fastestMs)}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Time</dt>
              <dd>{seconds(result.timeMs)}</dd>
            </div>
            <div>
              <dt>Hints</dt>
              <dd>{result.hintsUsed ?? 0}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Best</dt>
          <dd>{result.bestScore.toLocaleString("en")}</dd>
        </div>
      </dl>

      {result.newBest && (
        <p className="bg-result-best">⭐ رقم قياسي جديد لهذه المرحلة!</p>
      )}
      {result.unlockedStage && (
        <p className="bg-result-unlock">
          🔓 Stage {result.unlockedStage} Unlocked
        </p>
      )}

      <div className="bg-result-actions">
        {passed && result.nextStage && (
          <button type="button" className="bg-primary-lg" onClick={onNext}>
            <Play size={18} aria-hidden="true" /> Next Stage
          </button>
        )}
        <button type="button" className="secondary-button" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" />
          {passed ? "Retry" : "Try Again"}
        </button>
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" /> Back to Brain Games
        </button>
      </div>
    </div>
  );
}
