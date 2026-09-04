// Server-only reachability check for the active AI gateway. Never returns or
// logs the API key — only a boolean and a generic status.
import { resolveProvider } from "./config";
import { listModels } from "./gateway";

export type AiHealth = {
  ok: boolean;
  provider: ReturnType<typeof resolveProvider>;
};

export async function checkAiHealth(): Promise<AiHealth> {
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
