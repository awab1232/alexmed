// Pure grouping logic for a مِرآة deck that can hold several separate
// additions: its original upload plus any later pasted-text batches (each is
// its own mirror job, and every card carries the id of the job that made it —
// see drizzle/schema.ts's cards.jobId). Used by lib/db.ts's getDeckWithCards
// to label sections, order cards, pick the job the UI should poll, and decide
// which cards a PDF job's page images may attach to.

export type DeckJobInfo = {
  id: string;
  status: string;
  fileName: string;
  sourceType: string;
  createdAt: Date;
  failedBatchCount: number;
};

export type DeckCardRef = {
  jobId: string | null;
  createdAt: Date;
};

export type DeckSection = {
  id: string;
  label: string;
  sourceType: "file" | "text";
  cardCount: number;
};

// Section id for cards whose own job row no longer exists (deleted, so
// cards.jobId was set null) and which therefore can't be told apart from the
// deck's pre-existing cards.
export const ORIGINAL_SECTION_ID = "original";

const TERMINAL_STATUSES = new Set(["complete", "partial_failed", "failed"]);

function byCreatedAt<T extends { createdAt: Date }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
}

// Which section a card belongs to. A card with a job id belongs to that job.
// A card without one predates the column (or lost its job): it belongs to the
// deck's earliest job when that job existed by the time the card was made,
// otherwise to the synthetic "original" section — so a deleted original job
// can never make its cards look like they came from a later addition.
export function sectionIdForCard(
  card: DeckCardRef,
  jobs: DeckJobInfo[]
): string {
  if (card.jobId) return card.jobId;
  const [first] = byCreatedAt(jobs);
  return first && first.createdAt.getTime() <= card.createdAt.getTime()
    ? first.id
    : ORIGINAL_SECTION_ID;
}

// Sections in the order they were added, the original first. A job with no
// cards that has already finished (e.g. every batch failed) is left out so the
// filter chips only list sections a student can actually open.
export function buildDeckSections(
  jobs: DeckJobInfo[],
  cardRefs: DeckCardRef[]
): DeckSection[] {
  const counts = new Map<string, number>();
  for (const card of cardRefs) {
    const id = sectionIdForCard(card, jobs);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const sections: DeckSection[] = [];
  if (counts.has(ORIGINAL_SECTION_ID)) {
    sections.push({
      id: ORIGINAL_SECTION_ID,
      label: "الأصلي",
      sourceType: "file",
      cardCount: counts.get(ORIGINAL_SECTION_ID) ?? 0,
    });
  }
  for (const job of byCreatedAt(jobs)) {
    const cardCount = counts.get(job.id) ?? 0;
    if (cardCount === 0 && TERMINAL_STATUSES.has(job.status)) continue;
    sections.push({
      id: job.id,
      // The first section is "the file itself"; later ones use the name the
      // student gave that addition.
      label: sections.length === 0 ? "الأصلي" : job.fileName,
      sourceType: job.sourceType === "text" ? "text" : "file",
      cardCount,
    });
  }
  return sections;
}

// Stable ordering for the review list: section by section in the order they
// were added, and by source page within each.
export function sortCardsBySection<
  T extends { sectionId: string; sourcePage: number },
>(items: T[], sections: DeckSection[]): T[] {
  const rank = new Map(sections.map((section, index) => [section.id, index]));
  return [...items].sort(
    (a, b) =>
      (rank.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER) ||
      a.sourcePage - b.sourcePage
  );
}

// The one job the review UI reports on and polls: any still-generating job
// first (so live updates continue while a later addition runs), then the
// newest job with failed batches (so "التفاصيل" leads to something
// actionable), otherwise the newest job.
export function pickDeckJob(jobs: DeckJobInfo[]): DeckJobInfo | null {
  if (!jobs.length) return null;
  const newestFirst = byCreatedAt(jobs).reverse();
  return (
    newestFirst.find(job => !TERMINAL_STATUSES.has(job.status)) ??
    newestFirst.find(job => job.failedBatchCount > 0) ??
    newestFirst[0]
  );
}

export function totalFailedBatches(jobs: DeckJobInfo[]): number {
  return jobs.reduce((sum, job) => sum + job.failedBatchCount, 0);
}
