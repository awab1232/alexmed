"use client";

import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// 🧠 Brain Games home — every game with the player's real saved progress.
export default function BrainGamesHome() {
  const overview = trpc.brainGames.overview.useQuery();

  if (overview.isLoading) {
    return (
      <section className="bg-page" aria-busy="true">
        <header className="bg-hero">
          <h1>🧠 Brain Games</h1>
          <p>Train your brain. Beat your best.</p>
        </header>
        <div className="bg-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-card bg-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <section className="bg-page">
        <div className="bg-state">
          <h2>تعذر تحميل الألعاب</h2>
          <p>تحقق من الاتصال وحاول مرة ثانية.</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => overview.refetch()}
          >
            <RotateCcw size={16} aria-hidden="true" /> إعادة المحاولة
          </button>
        </div>
      </section>
    );
  }

  const games = overview.data;
  const isNewPlayer = games.every(game => !game.progress);

  return (
    <section className="bg-page">
      <header className="bg-hero">
        <Link href="/subjects" className="bg-back">
          <ChevronLeft size={18} aria-hidden="true" /> الرئيسية
        </Link>
        <h1>🧠 Brain Games</h1>
        <p>Train your brain. Beat your best.</p>
      </header>

      {isNewPlayer && (
        <div className="bg-welcome">
          <h2>🧠 Welcome to Brain Games</h2>
          <p>Challenge your memory, speed and logic.</p>
          <Link href="/games/math" className="primary-button">
            Start your first game →
          </Link>
        </div>
      )}

      <div className="bg-grid">
        {games.map(game => {
          const progress = game.progress;
          const completed = progress?.completedStages.length ?? 0;
          const stage = progress?.currentStage ?? 1;
          const percent = Math.round((completed / game.totalStages) * 100);
          return (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              className={`bg-card bg-card-${game.id}`}
              aria-label={`${game.title} — Stage ${stage} of ${game.totalStages}`}
            >
              <span className="bg-card-icon" aria-hidden="true">
                {game.emoji}
              </span>
              <strong className="bg-card-title">{game.title}</strong>
              <span className="bg-card-tagline">{game.tagline}</span>
              {progress ? (
                <>
                  <span className="bg-card-meta" dir="ltr">
                    <span>
                      Stage {stage} / {game.totalStages}
                    </span>
                    {progress.bestScore > 0 && (
                      <span>
                        Best {progress.bestScore.toLocaleString("en")}
                      </span>
                    )}
                  </span>
                  <span
                    className="bg-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={game.totalStages}
                    aria-valuenow={completed}
                    aria-label="المراحل المكتملة"
                  >
                    <span style={{ width: `${Math.max(2, percent)}%` }} />
                  </span>
                  <span className="bg-card-cta">▶ Continue Stage {stage}</span>
                </>
              ) : (
                <span className="bg-card-cta is-new">▶ Play Stage 1</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
