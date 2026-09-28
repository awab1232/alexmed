// Circuit breaker per AI model, shared by every replica through Postgres
// (ai_model_health) — no new infrastructure. When a model keeps failing
// with transient errors (429 / 5xx / timeouts / network), callers stop
// sending it traffic for a cooldown instead of each request (and each
// replica) rediscovering the outage and piling more load onto it:
//
//   closed ──(threshold consecutive failures)──> open
//   open ──(cooldown elapsed; ONE caller wins the probe)──> half_open
//   half_open ──success──> closed      half_open ──failure──> open
//
// Reads are cached per instance for a few seconds, so a healthy request
// path costs at most one small query per model per cache window. If the
// state can't be read or written the breaker fails OPEN-for-traffic
// (allows the call) — it must never be the reason AI is unavailable.
import { and, eq, lt, or, sql } from "drizzle-orm";
import { aiModelHealth } from "../../drizzle/schema";
import { getDb } from "../db";

export type BreakerState = "closed" | "open" | "half_open";

export type BreakerSnapshot = {
  state: BreakerState;
  consecutiveFailures: number;
  openedUntil: Date | null;
  probeStartedAt: Date | null;
};

export type BreakerDecision = "allow" | "probe" | "skip";

function readIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function breakerFailureThreshold(): number {
  return readIntEnv("AI_BREAKER_FAILURE_THRESHOLD", 5);
}

export function breakerCooldownMs(): number {
  return readIntEnv("AI_BREAKER_COOLDOWN_SECONDS", 60) * 1000;
}

// A probe that never reported back (its worker died) is abandoned after
// this long and another caller may probe — longer than one AI attempt.
const PROBE_TIMEOUT_MS = 5 * 60 * 1000;
const CACHE_TTL_MS = 5_000;

// Pure decision for one snapshot. "probe" means the cooldown is over and
// this caller should try to win the half-open probe (claimProbe).
export function decide(
  snapshot: BreakerSnapshot | null,
  now = Date.now()
): BreakerDecision {
  if (!snapshot || snapshot.state === "closed") return "allow";
  if (snapshot.state === "open") {
    return snapshot.openedUntil && snapshot.openedUntil.getTime() > now
      ? "skip"
      : "probe";
  }
  // half_open: someone is already probing — unless that probe went stale.
  return snapshot.probeStartedAt &&
    now - snapshot.probeStartedAt.getTime() < PROBE_TIMEOUT_MS
    ? "skip"
    : "probe";
}

// Earliest moment any of these open circuits allows a probe — what a
// caller that found every candidate open should wait before retrying.
export function msUntilNextProbe(
  snapshots: (BreakerSnapshot | null)[],
  now = Date.now()
): number {
  const waits = snapshots
    .filter((s): s is BreakerSnapshot => !!s && s.state === "open")
    .map(s => Math.max(0, (s.openedUntil?.getTime() ?? now) - now));
  return waits.length ? Math.min(...waits) : 0;
}

const cache = new Map<string, { at: number; value: BreakerSnapshot | null }>();

async function readSnapshot(model: string): Promise<BreakerSnapshot | null> {
  const hit = cache.get(model);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      state: aiModelHealth.state,
      consecutiveFailures: aiModelHealth.consecutiveFailures,
      openedUntil: aiModelHealth.openedUntil,
      probeStartedAt: aiModelHealth.probeStartedAt,
    })
    .from(aiModelHealth)
    .where(eq(aiModelHealth.model, model))
    .limit(1);
  const value = row
    ? {
        state: row.state as BreakerState,
        consecutiveFailures: row.consecutiveFailures,
        openedUntil: row.openedUntil,
        probeStartedAt: row.probeStartedAt,
      }
    : null;
  cache.set(model, { at: Date.now(), value });
  return value;
}

// Atomic: of all callers (on every replica) that see an expired open
// circuit at once, exactly one flips it to half_open and gets to probe.
async function claimProbe(model: string): Promise<boolean> {
  const db = getDb();
  if (!db) return true;
  const now = new Date();
  const staleProbe = new Date(now.getTime() - PROBE_TIMEOUT_MS);
  const rows = await db
    .update(aiModelHealth)
    .set({ state: "half_open", probeStartedAt: now, updatedAt: now })
    .where(
      and(
        eq(aiModelHealth.model, model),
        or(
          and(
            eq(aiModelHealth.state, "open"),
            lt(aiModelHealth.openedUntil, now)
          ),
          and(
            eq(aiModelHealth.state, "half_open"),
            lt(aiModelHealth.probeStartedAt, staleProbe)
          )
        )
      )
    )
    .returning({
      consecutiveFailures: aiModelHealth.consecutiveFailures,
      openedUntil: aiModelHealth.openedUntil,
    });
  if (!rows.length) {
    cache.delete(model);
    return false;
  }
  // Remember the half-open state we just wrote: recordModelSuccess only
  // writes when it knows the model had failures, and the probe's success
  // is exactly what must close the circuit.
  cache.set(model, {
    at: Date.now(),
    value: {
      state: "half_open",
      consecutiveFailures: rows[0].consecutiveFailures,
      openedUntil: rows[0].openedUntil,
      probeStartedAt: now,
    },
  });
  return true;
}

// Whether this caller may send a request to `model` now. Returns the
// snapshot too so a caller that skips every model can report how long to
// wait.
export async function checkModel(
  model: string
): Promise<{ allowed: boolean; snapshot: BreakerSnapshot | null }> {
  try {
    const snapshot = await readSnapshot(model);
    const decision = decide(snapshot);
    if (decision === "allow") return { allowed: true, snapshot };
    if (decision === "skip") return { allowed: false, snapshot };
    return { allowed: await claimProbe(model), snapshot };
  } catch (error) {
    console.error("[AI][breaker] state read failed; allowing the call", error);
    return { allowed: true, snapshot: null };
  }
}

// A success closes the circuit. Written only when this instance knows the
// model had failures recorded, so the healthy path adds no writes.
export async function recordModelSuccess(model: string): Promise<void> {
  try {
    const known = cache.get(model)?.value;
    if (!known || (known.state === "closed" && known.consecutiveFailures === 0))
      return;
    const db = getDb();
    if (!db) return;
    await db
      .update(aiModelHealth)
      .set({
        state: "closed",
        consecutiveFailures: 0,
        openedUntil: null,
        probeStartedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(aiModelHealth.model, model));
    cache.delete(model);
  } catch (error) {
    console.error("[AI][breaker] success write failed", error);
  }
}

// A transient failure. One atomic upsert: count it, and open the circuit
// when the count reaches the threshold — or immediately when it was the
// half-open probe that failed.
export async function recordModelFailure(
  model: string,
  errorType: string
): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    const threshold = breakerFailureThreshold();
    const cooldownSeconds = Math.round(breakerCooldownMs() / 1000);
    const t = aiModelHealth;
    await db
      .insert(t)
      .values({
        model,
        state: threshold <= 1 ? "open" : "closed",
        consecutiveFailures: 1,
        openedUntil:
          threshold <= 1
            ? sql`now() + make_interval(secs => ${cooldownSeconds})`
            : null,
        lastErrorType: errorType,
      })
      .onConflictDoUpdate({
        target: t.model,
        set: {
          consecutiveFailures: sql`${t.consecutiveFailures} + 1`,
          state: sql`CASE WHEN ${t.state} = 'half_open' OR ${t.consecutiveFailures} + 1 >= ${threshold} THEN 'open' ELSE ${t.state} END`,
          openedUntil: sql`CASE WHEN ${t.state} = 'half_open' OR (${t.state} = 'closed' AND ${t.consecutiveFailures} + 1 >= ${threshold}) THEN now() + make_interval(secs => ${cooldownSeconds}) ELSE ${t.openedUntil} END`,
          probeStartedAt: null,
          lastErrorType: errorType,
          updatedAt: sql`now()`,
        },
      });
    cache.delete(model);
  } catch (error) {
    console.error("[AI][breaker] failure write failed", error);
  }
}

// Test hook.
export function resetBreakerCacheForTests() {
  cache.clear();
}
