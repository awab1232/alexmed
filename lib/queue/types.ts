// Message shapes published to Upstash QStash — IDs only, never PDF text or
// OCR results, so the queue payload stays tiny regardless of file size. Each
// worker route re-fetches whatever content it needs from Postgres using the
// id(s) in the message.
export type QueueMessage =
  | { type: "generate_mirror_batch"; batchId: string; jobId: string }
  | { type: "finalize_mirror_job"; jobId: string }
  | { type: "analyze_book_chapter"; chapterId: string; bookId: string }
  | { type: "finalize_book"; bookId: string };

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Read lazily (not at module-load time) so tests can set process.env before
// calling these, and so a missing var falls back rather than crashing import.
export function getQueueMaxAttempts(): number {
  return readIntEnv("QUEUE_MAX_ATTEMPTS", 4);
}

export function getQueueGlobalConcurrency(): number {
  return readIntEnv("QUEUE_GLOBAL_CONCURRENCY", 5);
}

export function getQueuePerUserConcurrency(): number {
  return readIntEnv("QUEUE_PER_USER_CONCURRENCY", 2);
}

export function getJobCreationRateLimitMax(): number {
  return readIntEnv("JOB_CREATION_RATE_LIMIT_MAX", 5);
}

export function getJobCreationRateLimitWindowMinutes(): number {
  return readIntEnv("JOB_CREATION_RATE_LIMIT_WINDOW_MINUTES", 10);
}
