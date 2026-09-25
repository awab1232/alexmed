"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronLeft, Lock, Play, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { isBrainGameId, stageState } from "@/lib/brain-games/games";

function formatMs(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// One game: saved stats, "Continue Stage N" and the stage map.
export default function BrainGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const valid = isBrainGameId(gameId);
  const query = trpc.brainGames.game.useQuery(
    { gameId: valid ? gameId : "math" },
    { enabled: valid }
  );

  if (!valid) {
    return (
      <section className="bg-page">
        <div className="bg-state">
          <h2>اللعبة غير موجودة</h2>
          <Link href="/games" className="primary-button">
            العودة إلى Brain Games
          </Link>
        </div>
      </section>
    );
  }

  if (query.isLoading) {
    return (
      <section className="bg-page" aria-busy="true">
        <div className="bg-card bg-skeleton" style={{ height: 180 }} />
        <div className="bg-stage-grid">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="bg-stage bg-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (query.error || !query.data) {
    return (
      <section className="bg-page">
        <div className="bg-state">
          <h2>تعذر تحميل تقدمك</h2>
          <button
            type="button"
            className="primary-button"
            onClick={() => query.refetch()}
          >
            <RotateCcw size={16} aria-hidden="true" /> إعادة المحاولة
          </button>
        </div>
      </section>
    );
  }

  const game = query.data;
  const progress = game.progress;
  const current = progress?.currentStage ?? 1;
  const completed = progress?.completedStages.length ?? 0;
  const accuracy =
    progress && progress.totalCorrect + progress.totalWrong > 0
      ? Math.round(
          (progress.totalCorrect /
            (progress.totalCorrect + progress.totalWrong)) *
            100
        )
      : null;
  const resuming = game.activeSession?.stage === current;

  return (
    <section className="bg-page">
      <header className="bg-hero is-game">
        <Link href="/games" className="bg-back">
          <ChevronLeft size={18} aria-hidden="true" /> Brain Games
        </Link>
        <span className="bg-hero-icon" aria-hidden="true">
          {game.emoji}
        </span>
        <h1>{game.title}</h1>
        <p>{game.tagline}</p>
        <div className="bg-stats" dir="ltr">
          <div>
            <small>Stage</small>
            <strong>
              {current} / {game.totalStages}
            </strong>
          </div>
          <div>
            <small>Best</small>
            <strong>{(progress?.bestScore ?? 0).toLocaleString("en")}</strong>
          </div>
          <div>
            <small>Accuracy</small>
            <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
          </div>
          <div>
            <small>{game.kind === "sudoku" ? "Best time" : "Fastest"}</small>
            <strong>{formatMs(progress?.bestTimeMs)}</strong>
          </div>
        </div>
        <span
          className="bg-bar is-hero"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={game.totalStages}
          aria-valuenow={completed}
          aria-label="المراحل المكتملة"
        >
          <span
            style={{
              width: `${Math.max(2, (completed / game.totalStages) * 100)}%`,
            }}
          />
        </span>
        <Link
          href={`/games/${game.id}/play?stage=${current}`}
          className="bg-continue"
        >
          <Play size={18} aria-hidden="true" />
          {progress
            ? `${resuming ? "Resume" : "Continue"} Stage ${current}`
            : "Start Stage 1"}
        </Link>
      </header>

      <h2 className="bg-section-title">Stages</h2>
      <ol className="bg-stage-grid" aria-label="المراحل">
        {Array.from({ length: game.totalStages }, (_, i) => i + 1).map(
          stage => {
            const state = stageState(stage, progress);
            const best = progress?.stageBests[String(stage)];
            const label = `Stage ${stage} — ${
              state === "locked"
                ? "مقفلة"
                : state === "completed"
                  ? "مكتملة"
                  : state === "current"
                    ? "الحالية"
                    : "مفتوحة"
            }`;
            return (
              <li key={stage}>
                {state === "locked" ? (
                  <span
                    className="bg-stage is-locked"
                    role="img"
                    aria-label={label}
                  >
                    <Lock size={12} aria-hidden="true" />
                    {stage}
                  </span>
                ) : (
                  <Link
                    href={`/games/${game.id}/play?stage=${stage}`}
                    className={`bg-stage is-${state}`}
                    aria-label={label}
                  >
                    {state === "completed" && (
                      <Check size={12} aria-hidden="true" />
                    )}
                    {stage}
                    {best && <small>{best.score}</small>}
                  </Link>
                )}
              </li>
            );
          }
        )}
      </ol>
    </section>
  );
}
