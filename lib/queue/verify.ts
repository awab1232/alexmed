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
//
// Without APP_BASE_URL there is no trusted public URL to check against —
// falling back to request.url would let the request's own Host header pick
// the URL being verified — so verification fails closed. Publishing needs
// APP_BASE_URL too (lib/queue/client.ts), so a working setup always has it.
export async function verifyQStashRequest(
  rawBody: string,
  signature: string | null,
  request: Request
): Promise<boolean> {
  if (!signature) return false;
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    console.error("[Queue] APP_BASE_URL is not set — refusing worker call");
    return false;
  }
  const url = `${base}${new URL(request.url).pathname}`;
  try {
    return await getReceiver().verify({ signature, body: rawBody, url });
  } catch {
    return false;
  }
}
