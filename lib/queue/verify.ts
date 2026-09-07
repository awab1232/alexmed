// Verifies that an incoming request actually came from QStash — every
// worker route must call this before touching the database or invoking AI,
// so a student (or anyone else) can never trigger AI work by hitting a
// worker URL directly.
import { Receiver } from "@upstash/qstash";

let _receiver: Receiver | null = null;

function getReceiver(): Receiver {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    throw new Error(
      "QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY are not configured"
    );
  }
  if (!_receiver) {
    _receiver = new Receiver({ currentSigningKey, nextSigningKey });
  }
  return _receiver;
}

// `rawBody` must be the exact request body text (before JSON.parse) — QStash
// signs the raw bytes, so parsing first and re-stringifying can break
// verification if key order or whitespace differs.
//
// The URL QStash signed for is reconstructed from APP_BASE_URL + the
// incoming request's pathname, rather than trusting `request.url` verbatim —
// behind a reverse proxy (Railway, and most non-Vercel hosts) the app
// process often sees an internal scheme/host that doesn't match the public
// URL QStash actually called, which fails verification even for a genuine
// QStash request.
export async function verifyQStashRequest(
  rawBody: string,
  signature: string | null,
  request: Request
): Promise<boolean> {
  if (!signature) return false;
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
  const pathname = new URL(request.url).pathname;
  const url = base ? `${base}${pathname}` : request.url;
  try {
    return await getReceiver().verify({ signature, body: rawBody, url });
  } catch {
    return false;
  }
}
