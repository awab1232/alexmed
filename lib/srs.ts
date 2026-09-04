// Spaced-repetition scheduling for كتبي book cards — SM-2-style, pure, no
// I/O. See the approved plan's "SRS algorithm" for the rating table this
// implements: hard shrinks the interval (same-day when fresh), good grows it
// by the ease factor, easy grows it faster than good; ease factor is clamped
// so it never runs away or bottoms out.
export type SrsRating = "hard" | "good" | "easy";

export type SrsCardState = {
  easeFactor: number;
  intervalDays: number;
  reviewCount: number;
};

export type SrsUpdate = {
  easeFactor: number;
  intervalDays: number;
  dueAt: Date;
  reviewCount: number;
};

const MIN_EASE_FACTOR = 1.3;
const MAX_EASE_FACTOR = 3.0;

const EASE_FACTOR_DELTA: Record<SrsRating, number> = {
  hard: -0.2,
  good: 0,
  easy: 0.15,
};

function clampEaseFactor(value: number): number {
  return Math.min(MAX_EASE_FACTOR, Math.max(MIN_EASE_FACTOR, value));
}

export function applySrsRating(
  card: SrsCardState,
  rating: SrsRating,
  now: Date = new Date()
): SrsUpdate {
  const easeFactor = clampEaseFactor(
    card.easeFactor + EASE_FACTOR_DELTA[rating]
  );
  const isFirstReview = card.reviewCount === 0;

  let intervalDays: number;
  if (rating === "hard") {
    intervalDays = isFirstReview
      ? 0
      : Math.max(1, Math.round(card.intervalDays * 0.5));
  } else if (rating === "good") {
    // max(1, ...) guards against a card stuck at intervalDays 0 (e.g. rated
    // "hard" on its first review) multiplying by itself forever.
    intervalDays = isFirstReview
      ? 1
      : Math.max(1, Math.round(card.intervalDays * easeFactor));
  } else {
    intervalDays = isFirstReview
      ? 3
      : Math.max(1, Math.round(card.intervalDays * easeFactor * 1.3));
  }

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return {
    easeFactor,
    intervalDays,
    dueAt,
    reviewCount: card.reviewCount + 1,
  };
}
