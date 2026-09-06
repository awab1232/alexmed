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
export async function verifyQStashRequest(
  rawBody: string,
  signature: string | null,
  url: string
): Promise<boolean> {
  if (!signature) return false;
  try {
    return await getReceiver().verify({ signature, body: rawBody, url });
  } catch {
    return false;
  }
}
