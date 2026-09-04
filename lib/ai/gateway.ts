// Central AI gateway. Every AI call in this app goes through the functions
// here (generateText/generateJSON/streamText/embed/listModels) instead of
// any page/route talking to a provider directly — resolveProvider() picks
// OmniRoute or OpenRouter per lib/ai/config.ts, so callers never know which
// one actually served the request.
import { openRouterConfig, resolveProvider } from "./config";
import { omnirouteProvider } from "./providers/omniroute";
import { openrouterProvider } from "./providers/openrouter";
import { AiRateLimitError } from "./types";
import type {
  AiProvider,
  EmbedParams,
  EmbedResult,
  GenerateParams,
  GenerateResult,
  ModelInfo,
  StreamChunk,
} from "./types";

function getProvider(): AiProvider {
  return resolveProvider() === "omniroute"
    ? omnirouteProvider
    : openrouterProvider;
}

// When OmniRoute is the active provider and a single request to it fails for
// any reason other than a 429 (rate limiting already has its own
// retry-with-backoff UX client-side — see components/Home.tsx), fail over to
// OpenRouter for that one call instead of surfacing the error, as long as an
// OpenRouter key is actually configured. This keeps card/chapter generation
// working even during an OmniRoute outage (e.g. its Railway container
// hitting a resource-pressure guard and returning 503s).
async function generateTextWithFallback(
  params: GenerateParams
): Promise<GenerateResult> {
  const provider = getProvider();
  try {
    return await provider.generateText(params);
  } catch (error) {
    if (
      provider === omnirouteProvider &&
      !(error instanceof AiRateLimitError) &&
      openRouterConfig.apiKey
    ) {
      console.warn(
        "[AI] OmniRoute request failed, failing over to OpenRouter:",
        error instanceof Error ? error.message : error
      );
      return openrouterProvider.generateText(params);
    }
    throw error;
  }
}

export async function generateText(
  params: GenerateParams
): Promise<GenerateResult> {
  return generateTextWithFallback(params);
}

/** Same call shape as generateText — named separately so call sites that
 * expect structured JSON output (params.responseFormat.type === "json_schema")
 * read clearly at the call site. */
export async function generateJSON(
  params: GenerateParams
): Promise<GenerateResult> {
  return generateTextWithFallback(params);
}

export async function* streamText(
  params: GenerateParams
): AsyncGenerator<StreamChunk, void, void> {
  yield* getProvider().streamText(params);
}

export async function listModels(): Promise<ModelInfo[]> {
  return getProvider().listModels();
}

export async function embed(params: EmbedParams): Promise<EmbedResult> {
  const provider = getProvider();
  if (!provider.embed) {
    throw new Error(
      `embed() is not supported by the active AI provider (${resolveProvider()})`
    );
  }
  return provider.embed(params);
}

export { resolveProvider } from "./config";
export * from "./types";
