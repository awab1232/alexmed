// 🌍 General Knowledge stage builder over the curated bank.
import type { QuizQuestion } from "./games";
import {
  GK_BANK,
  GK_CATEGORY_LABELS,
  type GkDifficulty,
  type GkEntry,
} from "./general-knowledge-bank";
import type { Rng } from "./rng";

// Stage 1–10 easy · 11–30 medium · 31–60 hard · 61+ very hard.
export function gkDifficulty(stage: number): GkDifficulty {
  if (stage <= 10) return 1;
  if (stage <= 30) return 2;
  if (stage <= 60) return 3;
  return 4;
}

export function gkTimeLimitMs(stage: number): number {
  // Arabic questions + 4 options need reading time; harder tiers have
  // longer questions.
  return gkDifficulty(stage) <= 2 ? 10_000 : 12_000;
}

// How many recently seen ids are remembered to avoid repeats.
export const GK_RECENT_WINDOW = 60;

// Picks the stage's questions in this order of preference: unseen at the
// stage's own difficulty → unseen from the tier just below → the least
// recently seen ones. Never a duplicate inside a stage.
export function pickGkEntries(
  stage: number,
  count: number,
  rng: Rng,
  recentIds: string[],
  bank: GkEntry[] = GK_BANK
): GkEntry[] {
  const tier = gkDifficulty(stage);
  const recency = new Map(recentIds.map((id, i) => [id, i])); // 0 = oldest
  const pool = rng
    .shuffle(
      bank.filter(
        e => e.difficulty === tier || (tier > 1 && e.difficulty === tier - 1)
      )
    )
    .map(entry => ({
      entry,
      seen: recency.has(entry.id) ? 1 : 0,
      age: recency.get(entry.id) ?? -1,
      own: entry.difficulty === tier ? 0 : 1,
    }))
    .sort(
      (a, b) =>
        a.seen - b.seen ||
        (a.seen ? a.age - b.age : a.own - b.own) ||
        a.own - b.own
    );
  return rng.shuffle(pool.slice(0, count).map(p => p.entry));
}

export function generateGkStage(
  stage: number,
  rng: Rng,
  count: number,
  recentIds: string[]
): QuizQuestion[] {
  const timeLimitMs = gkTimeLimitMs(stage);
  return pickGkEntries(stage, count, rng, recentIds).map(entry => {
    const options = rng.shuffle([entry.answer, ...entry.wrong]);
    return {
      id: entry.id,
      prompt: entry.question,
      options,
      correctIndex: options.indexOf(entry.answer),
      timeLimitMs,
      explanation: entry.explanation,
      category: GK_CATEGORY_LABELS[entry.category],
    };
  });
}

// Keeps the most recent GK_RECENT_WINDOW ids, oldest first.
export function mergeRecentIds(recent: string[], played: string[]): string[] {
  const merged = [...recent.filter(id => !played.includes(id)), ...played];
  return merged.slice(-GK_RECENT_WINDOW);
}
