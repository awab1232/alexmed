// Distributed limiter for interactive AI requests — the ones a student
// waits on live (assistant, study chat, "اسأل AI" on the PDF, card
// explanation) and that therefore can't sit in the QStash queue. Backed by
// Postgres (ai_request_leases), so the limits hold across every replica —
// unlike an in-memory counter, whose effective limit is multiplied by the
// number of instances:
//   - global: at most N interactive AI requests in flight at once;
//   - per student: at most M in flight at once;
//   - per student: at most R started in the last 10 minutes.
// One atomic INSERT ... WHERE checks all three and takes the lease; rows
// then double as the per-student request history for the rate window.
// Under a burst, racing inserts can overshoot a cap by at most the number
// of simultaneous racers (READ COMMITTED, no lock) — it's a load guard,
// not an accounting ledger; the plan's daily quota (lib/billing) is exact.
//
// If the limiter's own table can't be reached it lets the request through
// (logged): the plan quota check that follows still applies.
import { sql } from "drizzle-orm";
import { getDb } from "../db";

export type InteractiveScope =
  | "assistant"
  | "study_chat"
  | "selection"
  | "explain_card";

export type InteractiveSlot =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; reason: "global_busy" | "user_busy" | "user_rate" };

function readIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function interactiveLimits() {
  return {
    global: readIntEnv("AI_INTERACTIVE_GLOBAL_CONCURRENCY", 20),
    perUser: readIntEnv("AI_INTERACTIVE_PER_USER_CONCURRENCY", 2),
    // Same budget the old per-instance limiter enforced (40 per 10 min).
    perUserWindow: readIntEnv("AI_INTERACTIVE_PER_USER_PER_10_MIN", 40),
  };
}

// Longer than the interactive routes' maxDuration (120s): a lease whose
// request died without releasing it stops counting after this.
const LEASE_TTL_SECONDS = 150;
const RATE_WINDOW_MINUTES = 10;

const RELEASED: InteractiveSlot = { ok: true, release: async () => {} };

export async function acquireInteractiveSlot(
  userId: string,
  scope: InteractiveScope
): Promise<InteractiveSlot> {
  const db = getDb();
  if (!db) return RELEASED;
  const limits = interactiveLimits();
  try {
    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO "ai_request_leases" ("userId", "scope", "expiresAt")
      SELECT ${userId}, ${scope}, now() + make_interval(secs => ${LEASE_TTL_SECONDS})
      WHERE
        (SELECT count(*) FROM "ai_request_leases"
          WHERE "releasedAt" IS NULL AND "expiresAt" > now()) < ${limits.global}
        AND (SELECT count(*) FROM "ai_request_leases"
          WHERE "userId" = ${userId} AND "releasedAt" IS NULL AND "expiresAt" > now()) < ${limits.perUser}
        AND (SELECT count(*) FROM "ai_request_leases"
          WHERE "userId" = ${userId}
            AND "createdAt" > now() - make_interval(mins => ${RATE_WINDOW_MINUTES})) < ${limits.perUserWindow}
      RETURNING "id"
    `);
    const id = result[0]?.id;
    maybePrune();
    if (id) {
      let released = false;
      return {
        ok: true,
        release: async () => {
          if (released) return;
          released = true;
          try {
            await db.execute(
              sql`UPDATE "ai_request_leases" SET "releasedAt" = now() WHERE "id" = ${id}`
            );
          } catch (error) {
            // The lease expires on its own; nothing else to do.
            console.error("[AI][limit] lease release failed", error);
          }
        },
      };
    }
    return { ok: false, reason: await rejectionReason(userId, limits) };
  } catch (error) {
    console.error("[AI][limit] limiter unavailable; allowing the call", error);
    return RELEASED;
  }
}

// Only runs on a rejection, to pick the right message.
async function rejectionReason(
  userId: string,
  limits: ReturnType<typeof interactiveLimits>
): Promise<"global_busy" | "user_busy" | "user_rate"> {
  const db = getDb();
  if (!db) return "global_busy";
  const [row] = await db.execute<{ user_live: number; user_window: number }>(
    sql`
      SELECT
        (SELECT count(*)::int FROM "ai_request_leases"
          WHERE "userId" = ${userId} AND "releasedAt" IS NULL AND "expiresAt" > now()) AS user_live,
        (SELECT count(*)::int FROM "ai_request_leases"
          WHERE "userId" = ${userId}
            AND "createdAt" > now() - make_interval(mins => ${RATE_WINDOW_MINUTES})) AS user_window
    `
  );
  if (Number(row?.user_window ?? 0) >= limits.perUserWindow) return "user_rate";
  if (Number(row?.user_live ?? 0) >= limits.perUser) return "user_busy";
  return "global_busy";
}

// Rows only matter for LEASE_TTL / the rate window; drop day-old ones now
// and then (about one acquisition in fifty), in small batches.
function maybePrune() {
  if (Math.random() >= 0.02) return;
  const db = getDb();
  if (!db) return;
  void db
    .execute(
      sql`DELETE FROM "ai_request_leases" WHERE "id" IN (
        SELECT "id" FROM "ai_request_leases"
        WHERE "createdAt" < now() - interval '1 day' LIMIT 1000)`
    )
    .catch(error => console.error("[AI][limit] prune failed", error));
}

export const INTERACTIVE_LIMIT_MESSAGE_AR: Record<
  Exclude<InteractiveSlot, { ok: true }>["reason"],
  string
> = {
  global_busy: "ضغط كبير على المساعد الآن، حاول بعد لحظات.",
  user_busy: "انتظر حتى يكتمل الرد الحالي، ثم اسأل من جديد.",
  user_rate: "أسئلة كثيرة خلال وقت قصير، خذ استراحة صغيرة ☕ وارجع بعد دقائق.",
};
