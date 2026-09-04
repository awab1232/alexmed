// OpenRouter.ai provider — moved from the old lib/llm.ts essentially as-is
// (same retry/backoff, same schema-instruction workaround, same model-list
// mapping). Kept as a fully working standalone fallback: setting
// LLM_PROVIDER=openrouter (or simply not configuring OMNIROUTE_API_KEY)
// routes every AI call through this file, unchanged from before the OmniRoute
// gateway was introduced.
import { openRouterConfig } from "../config";
import { parseOpenAiSseStream } from "../sse";
import {
  AiRateLimitError,
  type AiProvider,
  type GenerateParams,
  type GenerateResult,
  type Message,
  type ModelInfo,
  type ResponseFormat,
  type StreamChunk,
} from "../types";

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : undefined;
}

// "openrouter/free" is OpenRouter's own maintained meta-router: it randomly
// selects among currently-available free models (text+vision capable, 200k
// context, supports response_format/structured_outputs) — verified live
// against GET /api/v1/models on 2026-09-04. Deliberately NOT pinned to a
// specific vendor's free model (e.g. a particular Gemini/Llama/DeepSeek free
// tier), since those free listings churn frequently and a hardcoded id goes
// stale; this router self-heals as OpenRouter's free lineup changes.
export const DEFAULT_VISION_MODEL = "openrouter/free";
export const DEFAULT_TEXT_MODEL = "openrouter/free";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS_URL = "https://openrouter.ai/api/v1/models";

const RETRY_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 600;
const RETRY_MAX_DELAY_MS = 15_000;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const computeBackoffDelay = (attempt: number) => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  return cap / 2 + Math.random() * (cap / 2);
};

// Not every OpenRouter-hosted model supports strict `json_schema` structured
// output — that's a narrower per-provider capability, and the whole point of
// this integration is "any model works". So every structured request is
// downgraded to the widely-supported `json_object` mode; the actual JSON
// enforcement comes from the prompts (already say "Return JSON only") plus
// parseJsonResponse()'s fence-stripping in lib/pdf-cards.ts. This trades a
// strict-schema guarantee for provider coverage — deliberate.
function toOpenRouterResponseFormat(format: ResponseFormat | undefined) {
  if (!format) return undefined;
  if (format.type === "json_schema" || format.type === "json_object") {
    return { type: "json_object" as const };
  }
  return undefined;
}

// Downgrading json_schema -> json_object (above) drops the schema itself, so
// a model that was never told the required shape happily invents its own
// (observed live: gpt-4o-mini returned {"flashcards":[...]} instead of
// {"cards":[...]} — valid JSON, wrong shape, silently discarded downstream).
// Since the schema can no longer be enforced by the API, enforce it via the
// prompt instead: append it verbatim whenever json_schema was requested.
function appendSchemaInstruction(
  messages: Message[],
  format: ResponseFormat | undefined
): Message[] {
  if (!format || format.type !== "json_schema") return messages;

  const instruction =
    `Respond with a single JSON object that matches EXACTLY this JSON Schema — ` +
    `same field names, same nesting, no extra fields, no renamed fields, no prose, no markdown fences:\n\n` +
    JSON.stringify(format.json_schema.schema);

  return [...messages, { role: "user", content: instruction }];
}

function buildPayload(params: GenerateParams, stream: boolean) {
  const model = params.model?.trim() || DEFAULT_TEXT_MODEL;
  const payload: Record<string, unknown> = {
    model,
    messages: appendSchemaInstruction(params.messages, params.responseFormat),
  };
  if (typeof params.maxTokens === "number")
    payload.max_tokens = params.maxTokens;
  const mappedFormat = toOpenRouterResponseFormat(params.responseFormat);
  if (mappedFormat) payload.response_format = mappedFormat;
  if (stream) payload.stream = true;
  return payload;
}

function buildHeaders(apiKey: string) {
  const referer =
    process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000";
  return {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": referer,
    // HTTP header values must be Latin-1/ASCII (the Fetch API throws on
    // non-ByteString values) — the app's Arabic brand name can't go here,
    // so this is an ASCII-safe identifier for OpenRouter's dashboards only.
    "X-Title": "Mira Study Cards",
  };
}

async function generateText(params: GenerateParams): Promise<GenerateResult> {
  const apiKey = openRouterConfig.apiKey;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const payload = buildPayload(params, false);
  const headers = buildHeaders(apiKey);

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const raw = (await response.json()) as {
          id: string;
          created: number;
          model: string;
          choices: Array<{
            message: {
              role: string;
              content: string | null;
              reasoning?: string | null;
            };
            finish_reason: string | null;
          }>;
          usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          };
        };

        const choice = raw.choices[0];
        // Some models (mainly smaller "reasoning" ones on the free tier)
        // return their whole answer through `reasoning` and leave `content`
        // null instead of populating it — observed live with the
        // `openrouter/free` router landing on poolside/laguna-xs-2.1:free.
        return {
          id: raw.id,
          created: raw.created,
          model: raw.model,
          content: choice?.message.content ?? choice?.message.reasoning ?? "",
          finishReason: choice?.finish_reason ?? null,
          usage: raw.usage
            ? {
                promptTokens: raw.usage.prompt_tokens,
                completionTokens: raw.usage.completion_tokens,
                totalTokens: raw.usage.total_tokens,
              }
            : undefined,
        };
      }

      if (attempt === RETRY_MAX_RETRIES) {
        if (response.status === 429) {
          throw new AiRateLimitError(
            `LLM invoke failed: ${response.status} ${response.statusText}`,
            parseRetryAfterMs(response)
          );
        }
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
        );
      }
      console.warn(
        `[AI][openrouter] retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) break;
      console.warn(
        `[AI][openrouter] retry ${attempt + 1}/${RETRY_MAX_RETRIES} after error`,
        error
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM invoke failed after exhausting retries");
}

async function* streamText(
  params: GenerateParams
): AsyncGenerator<StreamChunk, void, void> {
  const apiKey = openRouterConfig.apiKey;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildPayload(params, true)),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `LLM stream failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  yield* parseOpenAiSseStream(response.body);
}

export type OpenRouterModel = ModelInfo;

const MODELS_CACHE_TTL_MS = 10 * 60 * 1000;
let modelsCache: { data: ModelInfo[]; fetchedAt: number } | null = null;

// Used only if OpenRouter's /models endpoint is unreachable, so the picker
// never renders empty. IDs verified live on 2026-09-04 — re-check periodically,
// OpenRouter's free-tier lineup in particular churns often.
const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: "openrouter/free",
    name: "Free Models Router",
    isFree: true,
    supportsImages: true,
    contextLength: 200000,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google: Gemma 4 31B (free)",
    isFree: true,
    supportsImages: false,
    contextLength: 262144,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "NVIDIA: Nemotron 3 Super (free)",
    isFree: true,
    supportsImages: false,
    contextLength: 262144,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    isFree: false,
    supportsImages: true,
    contextLength: 128000,
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    isFree: false,
    supportsImages: true,
    contextLength: 200000,
  },
];

async function listModels(): Promise<ModelInfo[]> {
  const now = Date.now();
  if (modelsCache && now - modelsCache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return modelsCache.data;
  }

  try {
    const response = await fetch(MODELS_URL);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = (await response.json()) as {
      data: Array<{
        id: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
        architecture?: { input_modalities?: string[] };
      }>;
    };

    const models: ModelInfo[] = body.data.map(model => ({
      id: model.id,
      name: model.name ?? model.id,
      isFree:
        model.pricing?.prompt === "0" && model.pricing?.completion === "0",
      supportsImages: Boolean(
        model.architecture?.input_modalities?.includes("image")
      ),
      contextLength: model.context_length ?? 0,
    }));

    models.sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    modelsCache = { data: models, fetchedAt: now };
    return models;
  } catch (error) {
    console.warn(
      "[AI][openrouter] Failed to fetch model list, using fallback:",
      error
    );
    return FALLBACK_MODELS;
  }
}

export const openrouterProvider: AiProvider = {
  generateText,
  streamText,
  listModels,
};
