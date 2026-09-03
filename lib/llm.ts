/**
 * Direct OpenRouter.ai integration (OpenAI-compatible Chat Completions API),
 * replacing the earlier single-provider Gemini adapter. OpenRouter proxies to
 * whichever model the caller names (free or paid, any vendor), so this file
 * stays a thin fetch wrapper instead of a per-provider schema adapter — the
 * `InvokeParams`/`InvokeResult` shapes below already match what OpenRouter
 * speaks natively, so lib/pdf-cards.ts and the PDF route handlers need no
 * changes beyond which `model` string they pass in.
 */

export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type MessageContent = string | TextContent | ImageContent;
export type Message = {
  role: "system" | "user" | "assistant";
  content: MessageContent | MessageContent[];
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  model?: string;
  max_tokens?: number;
  maxTokens?: number;
  response_format?: ResponseFormat;
  responseFormat?: ResponseFormat;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

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
// this change is "any model works". So every structured request is
// downgraded to the widely-supported `json_object` mode; the actual JSON
// enforcement comes from the prompts (already say "Return JSON only") plus
// `parseJsonResponse()`'s fence-stripping in lib/pdf-cards.ts. This trades a
// strict-schema guarantee for provider coverage — deliberate for this wave.
function toOpenRouterResponseFormat(format: ResponseFormat | undefined) {
  if (!format) return undefined;
  if (format.type === "json_schema" || format.type === "json_object") {
    return { type: "json_object" as const };
  }
  return undefined;
}

// Downgrading json_schema -> json_object (above) drops the schema itself, so
// a model that was never told the required shape happily invents its own
// (observed live: gpt-4o-mini returned {"flashcards":[{question, answer,
// explanation, ...}]} instead of {"cards":[{questionArabic, sourcePage,
// status, confidence, ...}]} — valid JSON, wrong shape, silently discarded
// downstream). Since the schema can no longer be enforced by the API, it has
// to be enforced by the prompt: append it verbatim as an explicit instruction
// whenever json_schema was requested.
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

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const responseFormat = params.response_format ?? params.responseFormat;
  const maxTokens = params.max_tokens ?? params.maxTokens;
  const model = params.model?.trim() || DEFAULT_TEXT_MODEL;

  const payload: Record<string, unknown> = {
    model,
    messages: appendSchemaInstruction(params.messages, responseFormat),
  };
  if (typeof maxTokens === "number") payload.max_tokens = maxTokens;
  const mappedFormat = toOpenRouterResponseFormat(responseFormat);
  if (mappedFormat) payload.response_format = mappedFormat;

  const referer =
    process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000";

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": referer,
          // HTTP header values must be Latin-1/ASCII (the Fetch API throws on
          // non-ByteString values) — the app's Arabic brand name can't go
          // here, so this is an ASCII-safe identifier for OpenRouter's
          // dashboards only, purely cosmetic.
          "X-Title": "Mira Study Cards",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const raw = (await response.json()) as {
          id: string;
          created: number;
          model: string;
          choices: Array<{
            index: number;
            message: {
              role: string;
              content: string | null;
              reasoning?: string | null;
            };
            finish_reason: string | null;
          }>;
          usage?: InvokeResult["usage"];
        };

        // Some models (mainly smaller "reasoning" ones on the free tier)
        // return their whole answer through `reasoning` and leave `content`
        // null instead of populating it — observed live with the
        // `openrouter/free` router landing on poolside/laguna-xs-2.1:free.
        // Since "any model works" is the point of this integration, fall
        // back to `reasoning` rather than silently returning empty text.
        return {
          id: raw.id,
          created: raw.created,
          model: raw.model,
          choices: raw.choices.map(choice => ({
            index: choice.index,
            message: {
              role: "assistant",
              content: choice.message.content ?? choice.message.reasoning ?? "",
            },
            finish_reason: choice.finish_reason,
          })),
          usage: raw.usage,
        };
      }

      if (attempt === RETRY_MAX_RETRIES) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
        );
      }
      console.warn(
        `[LLM] OpenRouter retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) break;
      console.warn(
        `[LLM] OpenRouter retry ${attempt + 1}/${RETRY_MAX_RETRIES} after error`,
        error
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM invoke failed after exhausting retries");
}

export type OpenRouterModel = {
  id: string;
  name: string;
  isFree: boolean;
  supportsImages: boolean;
  contextLength: number;
};

const MODELS_CACHE_TTL_MS = 10 * 60 * 1000;
let modelsCache: { data: OpenRouterModel[]; fetchedAt: number } | null = null;

// Used only if OpenRouter's /models endpoint is unreachable, so the picker
// never renders empty. IDs verified live on 2026-09-04 — re-check periodically,
// OpenRouter's free-tier lineup in particular churns often.
const FALLBACK_MODELS: OpenRouterModel[] = [
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

export async function listOpenRouterModels(): Promise<OpenRouterModel[]> {
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

    const models: OpenRouterModel[] = body.data.map(model => ({
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
      "[LLM] Failed to fetch OpenRouter model list, using fallback:",
      error
    );
    return FALLBACK_MODELS;
  }
}
