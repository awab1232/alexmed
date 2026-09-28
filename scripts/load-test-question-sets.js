// k6 load test for Protected Doctor Question Sets: many students redeeming
// codes at once, and many students opening the same already-processed set.
//
// Run by a human against STAGING only (its own database, QStash and AI key,
// DOCTOR_SETS_ENABLED=true, QUESTION_SET_CODE_HMAC_KEY set). Production
// hosts are refused below. Nothing in this repo runs it automatically.
//
//   CONFIRM_STAGING=yes BASE_URL=https://staging.example \
//   SET_ID=<published set uuid> CODES_FILE=./codes.csv \
//   SESSION_COOKIES_FILE=./cookies.txt TARGET_VUS=50 \
//   k6 run scripts/load-test-question-sets.js
//
// Required:
//   CONFIRM_STAGING=yes
//   BASE_URL              staging URL
//   SET_ID                a published set on staging
//   CODES_FILE            the CSV the doctor downloaded (header "code") —
//                         at least TARGET_VUS unused codes
//   SESSION_COOKIES_FILE  one "authjs.session-token=…" per line, one per
//                         distinct test student (codes are per student)
// Optional:
//   TARGET_VUS            10 → 25 → 50 → 100 → 250 → 500 (one stage per run)
//
// Expectations to verify during the run (Upstash console, DB connection
// graph, GET /api/health/ai as an admin):
//   * AI calls and QStash messages stay at ZERO — student traffic only reads;
//   * each code is claimed exactly once (first redeem "added"; any repeat by
//     the same student "already"; never two students on one code);
//   * p95 of questionSets.get stays < 1.5 s; no 5xx;
//   * image requests stream with Cache-Control: private, no-store.

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL;
const SET_ID = __ENV.SET_ID;
const TARGET_VUS = Number(__ENV.TARGET_VUS || 10);

if (!BASE_URL || !SET_ID || !__ENV.CODES_FILE || !__ENV.SESSION_COOKIES_FILE) {
  throw new Error(
    "Set BASE_URL, SET_ID, CODES_FILE and SESSION_COOKIES_FILE before running."
  );
}
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
    "Set CONFIRM_STAGING=yes to confirm BASE_URL is a staging deployment."
  );
}

const CODES = new SharedArray("codes", () =>
  open(__ENV.CODES_FILE)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && line !== "code")
);
const COOKIES = new SharedArray("cookies", () =>
  open(__ENV.SESSION_COOKIES_FILE)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
);

const redeemTime = new Trend("redeem_ms");
const openTime = new Trend("open_set_ms");
const appErrors = new Rate("app_5xx");
const doubleClaims = new Counter("unexpected_redeem_result");

export const options = {
  scenarios: {
    students: {
      executor: "per-vu-iterations",
      vus: TARGET_VUS,
      iterations: 1,
      maxDuration: "10m",
    },
  },
  thresholds: {
    app_5xx: ["rate<0.01"],
    open_set_ms: ["p(95)<1500"],
    unexpected_redeem_result: ["count==0"],
  },
};

function headers(cookie) {
  return { Cookie: cookie, "Content-Type": "application/json" };
}

function trpcData(res) {
  try {
    return res.json().result.data.json;
  } catch {
    return null;
  }
}

export default function () {
  const index = __VU - 1;
  const cookie = COOKIES[index % COOKIES.length];
  const code = CODES[index % CODES.length];

  // Everyone redeems at (nearly) the same moment.
  const started = Date.now();
  const redeem = http.post(
    `${BASE_URL}/api/trpc/questionSets.redeem`,
    JSON.stringify({ json: { code } }),
    { headers: headers(cookie) }
  );
  redeemTime.add(Date.now() - started);
  appErrors.add(redeem.status >= 500 ? 1 : 0);
  const redeemed = trpcData(redeem);
  if (!redeemed || !["added", "already"].includes(redeemed.outcome)) {
    // Only expected when COOKIES/CODES are shorter than TARGET_VUS (reuse).
    if (COOKIES.length >= TARGET_VUS && CODES.length >= TARGET_VUS) {
      doubleClaims.add(1);
    }
  }

  // Then each student opens the same set a few times, images included.
  for (let i = 0; i < 5; i++) {
    const t = Date.now();
    const res = http.get(
      `${BASE_URL}/api/trpc/questionSets.get?input=${encodeURIComponent(
        JSON.stringify({ json: { setId: SET_ID } })
      )}`,
      { headers: headers(cookie) }
    );
    openTime.add(Date.now() - t);
    appErrors.add(res.status >= 500 ? 1 : 0);
    check(res, {
      "set opens": r => r.status === 200,
      "no-store": r => (r.headers["Cache-Control"] || "").includes("no-store"),
    });
    const data = trpcData(res);
    const image = data && data.questions.find(q => q.imageUrl);
    if (image) {
      const img = http.get(`${BASE_URL}${image.imageUrl}`, {
        headers: { Cookie: cookie },
      });
      check(img, { "image streams": r => r.status === 200 });
    }
    sleep(1);
  }
}
