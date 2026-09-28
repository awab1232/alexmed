// Point-in-time AI load snapshot for operators (admin-only, surfaced by
// /api/health/ai). Counts and ages only — no ids, user data or content.
// Per-call detail (model, duration, 429 / 5xx / timeout, attempt) is in the
// structured "ai_call" / "ai_stream" / "generation_job" log lines
// (lib/ai/context.ts's logAiEvent); this answers "how deep is the queue and
// what is failing right now".
import { sql } from "drizzle-orm";
import { getDb } from "../db";

export type AiLoadSnapshot = {
  generation: {
    queued: number;
    processing: number;
    oldestQueuedSeconds: number | null;
    failedLastHour: Record<string, number>;
    completedLastHour: number;
    avgDurationSecondsLastHour: number | null;
  };
  chaptersProcessing: number;
  interactiveInFlight: number;
  openCircuits: {
    model: string;
    state: string;
    lastErrorType: string | null;
  }[];
};

export async function getAiLoadSnapshot(): Promise<AiLoadSnapshot | null> {
  const db = getDb();
  if (!db) return null;
  const [jobs] = await db.execute<{
    queued: number;
    processing: number;
    oldest_queued_seconds: number | null;
    completed_last_hour: number;
    avg_duration_seconds: number | null;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE "status" = 'queued')::int AS queued,
      count(*) FILTER (WHERE "status" = 'processing')::int AS processing,
      extract(epoch FROM now() - min("queuedAt") FILTER (WHERE "status" = 'queued'))::int AS oldest_queued_seconds,
      count(*) FILTER (WHERE "status" = 'completed' AND "completedAt" > now() - interval '1 hour')::int AS completed_last_hour,
      avg(extract(epoch FROM "completedAt" - "startedAt"))
        FILTER (WHERE "status" = 'completed' AND "completedAt" > now() - interval '1 hour')::int AS avg_duration_seconds
    FROM "chapter_generation_jobs"
  `);
  const failed = await db.execute<{ error_type: string | null; n: number }>(sql`
    SELECT "errorType" AS error_type, count(*)::int AS n
    FROM "chapter_generation_jobs"
    WHERE "status" = 'failed' AND "completedAt" > now() - interval '1 hour'
    GROUP BY "errorType"
  `);
  const [other] = await db.execute<{
    chapters_processing: number;
    interactive_in_flight: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM "book_chapters" WHERE "status" = 'processing') AS chapters_processing,
      (SELECT count(*)::int FROM "ai_request_leases"
        WHERE "releasedAt" IS NULL AND "expiresAt" > now()) AS interactive_in_flight
  `);
  const circuits = await db.execute<{
    model: string;
    state: string;
    last_error_type: string | null;
  }>(sql`
    SELECT "model", "state", "lastErrorType" AS last_error_type
    FROM "ai_model_health" WHERE "state" <> 'closed'
  `);
  return {
    generation: {
      queued: Number(jobs?.queued ?? 0),
      processing: Number(jobs?.processing ?? 0),
      oldestQueuedSeconds: jobs?.oldest_queued_seconds ?? null,
      failedLastHour: Object.fromEntries(
        [...failed].map(row => [row.error_type ?? "unknown", Number(row.n)])
      ),
      completedLastHour: Number(jobs?.completed_last_hour ?? 0),
      avgDurationSecondsLastHour: jobs?.avg_duration_seconds ?? null,
    },
    chaptersProcessing: Number(other?.chapters_processing ?? 0),
    interactiveInFlight: Number(other?.interactive_in_flight ?? 0),
    openCircuits: [...circuits].map(row => ({
      model: row.model,
      state: row.state,
      lastErrorType: row.last_error_type,
    })),
  };
}
