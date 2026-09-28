// k6 load-test harness for the chapter-generation job queue and the
// interactive AI limiter (lib/generation-jobs.ts, lib/ai/interactive-limit.ts).
//
// IMPORTANT: run by a human, against a STAGING environment (its own DB,
// QStash and an OmniRoute key with its own limits) — never against the live
// production DB/AI gateway: every iteration spends real AI calls. Nothing in
// this repo runs it automatically.
//
//   CONFIRM_STAGING=yes BASE_URL=https://staging.example \
//   SESSION_COOKIE="authjs.session-token=..." \
//   BOOK_ID=<uuid> CHAPTER_IDS=<uuid>,<uuid> TARGET_VUS=50 \
//   k6 run scripts/load-test-generation.js
//
// Required env vars:
//   CONFIRM_STAGING=yes — explicit confirmation; production hosts are
//                  refused regardless (PRODUCTION_HOSTS below)
//   BASE_URL, SESSION_COOKIE — as in scripts/load-test-mirror.js
//   BOOK_ID      — a fully processed book owned by the test account
//   CHAPTER_IDS  — comma-separated complete chapters of that book
// Optional:
//   TARGET_VUS   — peak virtual users (default 20)
//   KIND         — flashcards | mcqs | mindmap | visual_insights (default mcqs)
//   PAGE_NUMBER  — page used for the selection-assistant scenario (default 1)
//
// Expectations to verify (cross-check the Upstash console, the DB connection
// graph and GET /api/health/ai as an admin during the run):
//   * enqueue returns fast (< 1s p95) however many VUs hit it — the AI work
//     happens in /api/books/generation-job, capped by the QStash flow key
//     "chapter-generation-pipeline" (GENERATION_QUEUE_CONCURRENCY);
//   * repeated enqueues of the same chapter return the SAME job id (dedupe);
//   * the selection assistant answers 429 with the Arabic limiter message
//     once AI_INTERACTIVE_* caps are reached, instead of timing out;
//   * no 5xx from the app itself.
//
// All VUs share one account, so the per-user caps (plan concurrency,
// AI_INTERACTIVE_PER_USER_*) are what this mostly exercises; use several
// accounts' cookies across runs to load the global caps.

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL;
const SESSION_COOKIE = __ENV.SESSION_COOKIE;
const BOOK_ID = __ENV.BOOK_ID;
const CHAPTER_IDS = (__ENV.CHAPTER_IDS || "").split(",").filter(Boolean);
const TARGET_VUS = Number(__ENV.TARGET_VUS || 20);
const KIND = __ENV.KIND || "mcqs";
const PAGE_NUMBER = Number(__ENV.PAGE_NUMBER || 1);

if (!BASE_URL || !SESSION_COOKIE || !BOOK_ID || !CHAPTER_IDS.length) {
  throw new Error(
    "Set BASE_URL, SESSION_COOKIE, BOOK_ID and CHAPTER_IDS before running."
  );
}

// Hard stop against the live app: its hosts are refused outright, and any
// other target must be confirmed as staging explicitly.
const PRODUCTION_HOSTS = [
  "nirolearn.com",
  "www.nirolearn.com",
  "alexmed-production.up.railway.app",
];
const targetHost = BASE_URL.replace(/^https?:\/\//, "")
  .split(/[/:?#]/)[0]
  .toLowerCase();
if (PRODUCTION_HOSTS.includes(targetHost)) {
  throw new Error(`Refusing to load-test production (${targetHost}).`);
}
if (__ENV.CONFIRM_STAGING !== "yes") {
  throw new Error(
    "Set CONFIRM_STAGING=yes to confirm BASE_URL is a staging deployment " +
      "with its own database, QStash and AI key."
  );
}

const MUTATION_BY_KIND = {
  flashcards: "books.generateChapterFlashcards",
  mcqs: "books.generateChapterMcqs",
  mindmap: "books.generateMindMapSections",
  visual_insights: "books.generateVisualInsights",
};

const enqueueTime = new Trend("generation_enqueue_ms");
const jobSettleTime = new Trend("generation_job_settle_ms");
const jobFailed = new Rate("generation_job_failed");
const appErrors = new Rate("app_5xx");
const interactiveLimited = new Counter("interactive_limited_429");
const interactiveTime = new Trend("interactive_first_byte_ms");

export const options = {
  scenarios: {
    generation: {
      executor: "ramping-vus",
      exec: "generation",
      startVUs: 0,
      stages: [
        { duration: "30s", target: TARGET_VUS },
        { duration: "3m", target: TARGET_VUS },
        { duration: "30s", target: 0 },
      ],
    },
    interactive: {
      executor: "constant-vus",
      exec: "interactive",
      vus: Math.max(1, Math.round(TARGET_VUS / 2)),
      duration: "4m",
    },
  },
  thresholds: {
    app_5xx: ["rate<0.01"],
    generation_enqueue_ms: ["p(95)<1000"],
  },
};

function headers() {
  return { Cookie: SESSION_COOKIE, "Content-Type": "application/json" };
}

// tRPC over HTTP with the superjson transformer (lib/trpc/trpc.ts).
function trpcMutation(path, input) {
  return http.post(
    `${BASE_URL}/api/trpc/${path}`,
    JSON.stringify({ json: input }),
    { headers: headers() }
  );
}

function trpcQuery(path, input) {
  return http.get(
    `${BASE_URL}/api/trpc/${path}?input=${encodeURIComponent(
      JSON.stringify({ json: input })
    )}`,
    { headers: headers() }
  );
}

function data(res) {
  try {
    return res.json().result.data.json;
  } catch {
    return null;
  }
}

export function generation() {
  const chapterId = CHAPTER_IDS[(__VU + __ITER) % CHAPTER_IDS.length];
  const started = Date.now();
  const res = trpcMutation(MUTATION_BY_KIND[KIND], { chapterId });
  enqueueTime.add(Date.now() - started);
  appErrors.add(res.status >= 500 ? 1 : 0);
  const job = data(res);
  if (!check(res, { enqueued: r => r.status === 200 && !!job })) return;

  // Dedupe: a second enqueue while the first is active returns the same job.
  const again = data(trpcMutation(MUTATION_BY_KIND[KIND], { chapterId }));
  check(again, {
    "same job while active": j =>
      !!j && (j.id === job.id || j.status === "completed"),
  });

  const pollStart = Date.now();
  let settled = null;
  while (Date.now() - pollStart < 10 * 60 * 1000) {
    sleep(3);
    const jobs = data(trpcQuery("books.generationJobs", { bookId: BOOK_ID }));
    const mine = jobs && jobs.find(j => j.id === job.id);
    if (mine && (mine.status === "completed" || mine.status === "failed")) {
      settled = mine;
      break;
    }
  }
  jobSettleTime.add(Date.now() - pollStart);
  jobFailed.add(!settled || settled.status === "failed" ? 1 : 0);
}

export function interactive() {
  const started = Date.now();
  const res = http.post(
    `${BASE_URL}/api/books/ask-selection`,
    JSON.stringify({
      bookId: BOOK_ID,
      pageNumber: PAGE_NUMBER,
      selectedText: "",
      action: "summarize",
    }),
    { headers: headers(), timeout: "180s" }
  );
  appErrors.add(res.status >= 500 ? 1 : 0);
  if (res.status === 429) {
    interactiveLimited.add(1);
  } else {
    check(res, { "assistant ok": r => r.status === 200 });
    interactiveTime.add(Date.now() - started);
  }
  sleep(2);
}
