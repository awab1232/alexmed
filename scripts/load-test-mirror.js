// k6 load-test harness for the مِرآة upload -> QStash queue pipeline.
//
// IMPORTANT: this script is meant to be run by a human, against a STAGING
// environment or with the AI provider stubbed — never against the live
// production DB/AI gateway. It is not executed automatically by anything in
// this repo.
//
// Install k6: https://k6.io/docs/get-started/installation/
// Run one stage at a time, e.g.:
//   BASE_URL=https://your-staging-url TARGET_VUS=100 k6 run scripts/load-test-mirror.js
//   BASE_URL=https://your-staging-url TARGET_VUS=500 k6 run scripts/load-test-mirror.js
//   BASE_URL=https://your-staging-url TARGET_VUS=1000 k6 run scripts/load-test-mirror.js
//   BASE_URL=https://your-staging-url TARGET_VUS=2000 k6 run scripts/load-test-mirror.js
//
// Required env vars:
//   BASE_URL     — staging URL (e.g. https://study-card-maker-staging.vercel.app)
//   SESSION_COOKIE — a valid next-auth session cookie value for a real test
//                    account, e.g. "authjs.session-token=...". Log in once
//                    in a browser against staging and copy it from devtools.
//   TARGET_VUS   — peak virtual users for this run (100 / 500 / 1000 / 2000)
// Optional:
//   PDF_PATH     — path to a small sample PDF to upload (defaults to a tiny
//                  generated single-page PDF below so the script runs with
//                  zero setup).
//
// What this measures (see the summary k6 prints at the end, and the custom
// trends below): job-creation latency, end-to-end time from upload to the
// job reaching a terminal status, and the error rate at each stage — cross-
// reference against the Upstash QStash console (retry rate, DLQ size) and
// your Postgres provider's connection-count dashboard during the same run.

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL;
const SESSION_COOKIE = __ENV.SESSION_COOKIE;
const TARGET_VUS = Number(__ENV.TARGET_VUS || 100);

if (!BASE_URL || !SESSION_COOKIE) {
  throw new Error(
    "Set BASE_URL and SESSION_COOKIE env vars before running this script."
  );
}

// A minimal valid single-page PDF, inlined so the script needs no external
// fixture file. Replace with a real multi-page exam PDF (via PDF_PATH) for a
// more realistic test — this trivial one exercises the pipeline's plumbing,
// not its OCR/large-file behavior.
const TINY_PDF = open(
  __ENV.PDF_PATH || "./scripts/fixtures/tiny-sample.pdf",
  "b"
);

const jobCreationTime = new Trend("job_creation_duration_ms");
const jobCompletionTime = new Trend("job_completion_duration_ms");
const jobErrorRate = new Rate("job_error_rate");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: TARGET_VUS },
        { duration: "2m", target: TARGET_VUS },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    job_error_rate: ["rate<0.05"], // fail the run if >5% of jobs error
  },
};

function headers(extra) {
  return Object.assign(
    { Cookie: SESSION_COOKIE, "Content-Type": "application/json" },
    extra || {}
  );
}

export default function () {
  const fileName = `load-test-${__VU}-${__ITER}.pdf`;

  // 1. Presigned upload URL
  const uploadUrlRes = http.post(
    `${BASE_URL}/api/pdf/upload-url`,
    JSON.stringify({
      fileName,
      fileSize: TINY_PDF.byteLength,
      contentType: "application/pdf",
    }),
    { headers: headers() }
  );
  if (
    !check(uploadUrlRes, { "upload-url ok": r => r.status === 200 })
  ) {
    jobErrorRate.add(1);
    return;
  }
  const { key, uploadUrl } = uploadUrlRes.json();

  // 2. PUT the file bytes directly to storage
  const putRes = http.put(uploadUrl, TINY_PDF, {
    headers: { "Content-Type": "application/pdf" },
  });
  if (!check(putRes, { "storage put ok": r => r.status < 300 })) {
    jobErrorRate.add(1);
    return;
  }

  // 3. Create the job (this is what publishes QStash messages)
  const planStart = Date.now();
  const planRes = http.post(
    `${BASE_URL}/api/mirror/upload-and-plan`,
    JSON.stringify({ key, fileName, depth: "balanced" }),
    { headers: headers() }
  );
  const planOk = check(planRes, { "plan created": r => r.status === 200 });
  jobCreationTime.add(Date.now() - planStart);
  if (!planOk) {
    jobErrorRate.add(1);
    return;
  }
  const { jobId } = planRes.json();

  // 4. Poll job status until terminal (mirrors the client's own polling
  // interval) or a generous timeout, to measure end-to-end completion time.
  const pollStart = Date.now();
  const POLL_TIMEOUT_MS = 120_000;
  let terminal = false;
  while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
    sleep(3);
    const statusRes = http.get(
      `${BASE_URL}/api/trpc/mirror.get?input=${encodeURIComponent(
        JSON.stringify({ id: jobId })
      )}`,
      { headers: headers() }
    );
    if (statusRes.status !== 200) continue;
    let status;
    try {
      status =
        statusRes.json().result.data.job.status; // tRPC query response shape
    } catch {
      continue;
    }
    if (status === "complete" || status === "partial_failed") {
      terminal = true;
      break;
    }
  }
  jobCompletionTime.add(Date.now() - pollStart);
  jobErrorRate.add(terminal ? 0 : 1);
}
