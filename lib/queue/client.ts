// Thin wrapper around @upstash/qstash's Client — the only place in the app
// that knows how to turn a QueueMessage into a published QStash request.
// Destination URLs are resolved from APP_BASE_URL so the same code works in
// local dev (with a tunnel), preview deployments, and production.
import { Client, type FlowControl } from "@upstash/qstash";
import type { QueueMessage } from "./types";
import { getQueueMaxAttempts } from "./types";

let _client: Client | null = null;

function getClient(): Client {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error("QSTASH_TOKEN is not configured");
  }
  if (!_client) {
    _client = new Client({ token });
  }
  return _client;
}

function getBaseUrl(): string {
  const base = process.env.APP_BASE_URL;
  if (!base) {
    throw new Error("APP_BASE_URL is not configured");
  }
  return base.replace(/\/$/, "");
}

// Maps each message type to the worker route that handles it.
function resolveDestination(message: QueueMessage): string {
  const base = getBaseUrl();
  switch (message.type) {
    case "generate_mirror_batch":
      return `${base}/api/mirror/generate-batch`;
    case "finalize_mirror_job":
      return `${base}/api/mirror/finalize`;
    case "analyze_book_chapter":
      return `${base}/api/books/analyze-chapter`;
    case "finalize_book":
      return `${base}/api/books/finalize`;
  }
}

// QStash's own retry schedule: immediate, then 10s, 30s, 90s (10 * 3^attempt)
// — matches the exact backoff the product spec asked for, expressed as a
// QStash `retryDelay` formula rather than an in-app sleep loop.
const RETRY_DELAY_FORMULA = "10 * pow(3, retried)";

export async function publishMessage(
  message: QueueMessage,
  options?: { retries?: number; flowControl?: FlowControl }
): Promise<void> {
  const client = getClient();
  await client.publishJSON({
    url: resolveDestination(message),
    body: message,
    retries: options?.retries ?? getQueueMaxAttempts() - 1,
    retryDelay: RETRY_DELAY_FORMULA,
    flowControl: options?.flowControl,
  });
}
