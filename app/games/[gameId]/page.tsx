"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCcw,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { isBrainGameId } from "@/lib/brain-games/games";

function formatMs(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} ث`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// One game: the level as a compact "12/100" at the top (arrows step back
// through unlocked levels to replay one), the saved stats, and Play.
export default function BrainGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const valid = isBrainGameId(gameId);
  const query = trpc.brainGames.game.useQuery(
    { gameId: valid ? gameId : "math" },
    { enabled: valid }
  );

  const progress = query.data?.progress ?? null;
  const current = progress?.currentStage ?? 1;
  const highest = progress?.highestUnlockedStage ?? 1;
  const [selected, setSelected] = useState<number | null>(null);
  // Follow the player's real level until they pick another one.
  useEffect(() => {
    setSelected(null);
  }, [current]);
  const stage = selected ?? current;

  if (!valid) {
    return (
      <section className="bg-page">
        <div className="bg-state">
          <h2>اللعبة غير موجودة</h2>
          <Link href="/games" className="primary-button">
            العودة إلى الألعاب
          </Link>
        </div>
      </section>
    );
  }

  if (query.isLoading) {
    return (
      <section className="bg-page" aria-busy="true">
        <div className="bg-card bg-skeleton" style={{ height: 260 }} />
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
  const completed = progress?.completedStages.length ?? 0;
  const accuracy =
    progress && progress.totalCorrect + progress.totalWrong > 0
      ? Math.round(
          (progress.totalCorrect /
            (progress.totalCorrect + progress.totalWrong)) *
            100
        )
      : null;
  const stageBest = progress?.stageBests[String(stage)];
  const stageDone = progress?.completedStages.includes(stage) ?? false;
  const resuming = game.activeSession?.stage === stage;

  return (
    <section className="bg-page">
      <header className="bg-hero is-game">
        <Link href="/games" className="bg-back">
          <ChevronRight size={18} aria-hidden="true" /> الألعاب
        </Link>
        <span className="bg-hero-icon" aria-hidden="true">
          {game.emoji}
        </span>
        <h1>{game.titleAr}</h1>
        <p>{game.taglineAr}</p>

        <div className="bg-level" role="group" aria-label="اختيار المستوى">
          <button
            type="button"
            className="bg-level-step"
            onClick={() => setSelected(Math.max(1, stage - 1))}
            disabled={stage <= 1}
            aria-label="المستوى السابق"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
          <div className="bg-level-value" aria-live="polite">
            <small>المستوى</small>
            <strong>
              <bdi dir="ltr">
                {stage}/{game.totalStages}
              </bdi>
            </strong>
            {stageDone ? (
              <span className="bg-level-note">
                <Check size={13} aria-hidden="true" /> مكتمل
                {stageBest ? ` · ${stageBest.score.toLocaleString("en")}` : ""}
              </span>
            ) : (
              <span className="bg-level-note">
                {stage === current ? "مستواك الحالي" : "مفتوح"}
              </span>
            )}
          </div>
          <button
            type="button"
            className="bg-level-step"
            onClick={() => setSelected(Math.min(highest, stage + 1))}
            disabled={stage >= highest}
            aria-label="المستوى التالي"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        </div>

        <span
          className="bg-bar is-hero"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={game.totalStages}
          aria-valuenow={completed}
          aria-label="المستويات المكتملة"
        >
          <span
            style={{
              width: `${Math.max(2, (completed / game.totalStages) * 100)}%`,
            }}
          />
        </span>

        <Link
          href={`/games/${game.id}/play?stage=${stage}`}
          className="bg-continue"
        >
          <Play size={18} aria-hidden="true" />
          {resuming
            ? `أكمل المستوى ${stage}`
            : stageDone
              ? `أعد لعب المستوى ${stage}`
              : progress
                ? `العب المستوى ${stage}`
                : "ابدأ المستوى 1"}
        </Link>
      </header>

      <div className="bg-stats is-light">
        <div>
          <small>أفضل نتيجة</small>
          <strong>
            <bdi>{(progress?.bestScore ?? 0).toLocaleString("en")}</bdi>
          </strong>
        </div>
        <div>
          <small>الدقة</small>
          <strong>
            <bdi>{accuracy === null ? "—" : `${accuracy}%`}</bdi>
          </strong>
        </div>
        <div>
          <small>{game.kind === "sudoku" ? "أسرع حل" : "أسرع إجابة"}</small>
          <strong>
            <bdi>{formatMs(progress?.bestTimeMs)}</bdi>
          </strong>
        </div>
      </div>
    </section>
  );
}
