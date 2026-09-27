// Server-only reachability check for the active AI gateway. Never returns or
// logs the API key — only a boolean and a generic status.
import { resolveProvider } from "./config";
import { listModels } from "./gateway";

export type AiHealth = {
  ok: boolean;
  provider: ReturnType<typeof resolveProvider>;
};

// The endpoint is public (a deploy health check may poll it), so the
// upstream call is made at most once per minute per instance — requests
// can't be turned into a stream of calls to the AI provider.
const CACHE_MS = 60_000;
let cached: { at: number; value: Promise<AiHealth> } | null = null;

export function checkAiHealth(): Promise<AiHealth> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  cached = { at: Date.now(), value: checkAiHealthUncached() };
  return cached.value;
}

async function checkAiHealthUncached(): Promise<AiHealth> {
  const provider = resolveProvider();
  try {
    const models = await listModels();
    return { ok: models.length > 0, provider };
  } catch (error) {
    console.warn(
      "[AI] health check failed:",
      error instanceof Error ? error.message : error
    );
    return { ok: false, provider };
  }
}
