// OmniRoute provider — a self-hosted OpenAI-compatible AI gateway (Railway).
// This is now the default AI path for the app once OMNIROUTE_API_KEY is set
// (see lib/ai/config.ts's resolveProvider()). OmniRoute already does its own
// routing/retries/fallbacks upstream, so this client keeps its own retry
// behavior deliberately conservative (network failures / 5xx only, never on
// 429 — retrying a rate-limit against a gateway that already handles rate-
// limit routing itself would just duplicate requests for no benefit).
import { omniRouteConfig } from "../config";
import { parseOpenAiSseStream } from "../sse";
import {
  AiRateLimitError,
  type AiProvider,
  type EmbedParams,
  type EmbedResult,
  type GenerateParams,
  type GenerateResult,
  type Message,
  type ModelInfo,
  type StreamChunk,
} from "../types";

function parseRetryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : undefined;
}

// Vercel Hobby caps a single serverless invocation at 60s total, no matter
// what maxDuration is set to — this budget (one attempt + one retry) must
// fit comfortably under that ceiling, not just under an assumed one.
const REQUEST_TIMEOUT_MS = 27_000;
const RETRY_MAX_RETRIES = 1; // conservative — see file header.
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

function requireApiKey(): string {
  const key = omniRouteConfig.apiKey;
  if (!key) throw new Error("OMNIROUTE_API_KEY is not configured");
  return key;
}

function headers(apiKey: string) {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
}

// Maps an OmniRoute/upstream HTTP failure to a clear, distinct server-side
// log line — status + a short generic reason, NEVER the API key and never
// the raw request/response body (which could echo back sensitive upstream
// provider error details). The thrown Error's message is safe to bubble up
// to route handlers, which already show their own Arabic user-facing copy
// and never surface this raw string to the client.
function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return "unauthorized (check OMNIROUTE_API_KEY)";
    case 403:
      return "forbidden";
    case 404:
      return "endpoint not found (check OMNIROUTE_BASE_URL)";
    case 429:
      return "rate limited upstream";
    case 500:
      return "OmniRoute internal error";
    case 502:
    case 503:
      return "OmniRoute or upstream provider unavailable";
    default:
      return `unexpected status ${status}`;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      // Only retry network-shaped failures via 5xx; never 429 (see header).
      if (response.ok || response.status < 500) return response;
      if (attempt === RETRY_MAX_RETRIES) return response;
      console.warn(
        `[AI][omniroute] retrying after ${describeStatus(response.status)}`
      );
      await sleep(RETRY_DELAY_MS);
    } catch (error) {
      lastError = error;
      // A timeout (AbortSignal firing) is NOT the same as a fast network
      // failure: OmniRoute may still be mid-flight on the request we just
      // gave up on. Retrying here would fire a second, duplicate job at an
      // already-slow/overloaded upstream instead of giving it room to
      // recover — fail fast instead of piling on.
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      if (isTimeout || attempt === RETRY_MAX_RETRIES) throw error;
      console.warn("[AI][omniroute] retrying after network error");
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("OmniRoute request failed");
}

// Downgrading json_schema -> json_object below drops the schema itself, so a
// model that was never told the required shape happily invents its own
// (verified live: without this, OmniRoute's chat models returned valid JSON
// that silently lacked a `cards` array — parsed fine, produced zero cards
// downstream). Same fix as the OpenRouter provider: since the gateway can no
// longer enforce the schema, the prompt has to.
function appendSchemaInstruction(
  messages: Message[],
  format: GenerateParams["responseFormat"]
): Message[] {
  if (!format || format.type !== "json_schema") return messages;

  const instruction =
    `Respond with a single JSON object that matches EXACTLY this JSON Schema — ` +
    `same field names, same nesting, no extra fields, no renamed fields, no prose, no markdown fences:\n\n` +
    JSON.stringify(format.json_schema.schema);

  return [...messages, { role: "user", content: instruction }];
}

function hasImageContent(messages: Message[]): boolean {
  return messages.some(message => {
    const parts = Array.isArray(message.content)
      ? message.content
      : [message.content];
    return parts.some(
      part => typeof part === "object" && part.type === "image_url"
    );
  });
}

const MODELS_CACHE_TTL_MS = 10 * 60 * 1000;
let modelsCache: { data: ModelInfo[]; fetchedAt: number } | null = null;

async function fetchModels(): Promise<ModelInfo[]> {
  const now = Date.now();
  if (modelsCache && now - modelsCache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return modelsCache.data;
  }

  const apiKey = requireApiKey();
  const response = await fetchWithTimeout(`${omniRouteConfig.baseUrl}/models`, {
    method: "GET",
    headers: headers(apiKey),
  });

  if (!response.ok) {
    throw new Error(
      `OmniRoute models list failed: ${describeStatus(response.status)}`
    );
  }

  const body = (await response.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      context_length?: number;
      // Verified live against the real endpoint: OmniRoute's /v1/models does
      // NOT expose OpenRouter-style pricing/architecture fields at all — real
      // entries look like { id, object, created, owned_by, context_length,
      // max_input_tokens, max_output_tokens, capabilities: {tool_calling,
      // reasoning, thinking, temperature} }, no cost or modality info. These
      // two are kept only in case a future OmniRoute version adds them.
      pricing?: { prompt?: string; completion?: string };
      architecture?: { input_modalities?: string[] };
    }>;
  };

  // No pricing/modality metadata exists to check (see above), so isFree /
  // supportsImages fall back to a naming-convention heuristic — OmniRoute's
  // own ids are literal about this (e.g. "auto/best-vision", "auto/multimodal",
  // "auto/best-free", "auto/coding:free", "oc/deepseek-v4-flash-free").
  const models: ModelInfo[] = (body.data ?? []).map(model => {
    const id = model.id.toLowerCase();
    return {
      id: model.id,
      name: model.name ?? model.id,
      isFree: model.pricing
        ? model.pricing.prompt === "0" && model.pricing.completion === "0"
        : /(^|[/:-])free($|[/:-])/.test(id),
      supportsImages: model.architecture?.input_modalities?.includes("image")
        ? true
        : /vision|multimodal/.test(id),
      contextLength: model.context_length ?? 0,
    };
  });

  modelsCache = { data: models, fetchedAt: now };
  return models;
}

// OMNIROUTE_DEFAULT_MODEL wins when set (no network call, no guessing). If
// unset, fetch the real live model list once (cached) and pick a model that
// actually exists rather than inventing an id — preferring a vision-capable
// one when the request includes an image.
async function resolveModel(params: GenerateParams): Promise<string> {
  if (params.model?.trim()) return params.model.trim();
  if (omniRouteConfig.defaultModel) return omniRouteConfig.defaultModel;

  const models = await fetchModels();
  if (!models.length) {
    throw new Error(
      "OmniRoute: no model specified and the live model list is empty — set OMNIROUTE_DEFAULT_MODEL"
    );
  }

  const needsVision = hasImageContent(params.messages);
  const match = needsVision
    ? models.find(model => model.supportsImages)
    : undefined;
  return (match ?? models[0]).id;
}

function buildPayload(model: string, params: GenerateParams, stream: boolean) {
  const payload: Record<string, unknown> = {
    model,
    messages: appendSchemaInstruction(params.messages, params.responseFormat),
  };
  if (typeof params.maxTokens === "number")
    payload.max_tokens = params.maxTokens;
  if (params.responseFormat?.type === "json_schema") {
    // Same reasoning as the OpenRouter provider: not every model behind an
    // OpenAI-compatible gateway honors strict json_schema mode, so downgrade
    // to the widely-supported json_object mode and let the prompt (already
    // ending in "Return JSON only" in lib/pdf-cards.ts) carry the shape.
    payload.response_format = { type: "json_object" };
  } else if (params.responseFormat?.type === "json_object") {
    payload.response_format = { type: "json_object" };
  }
  if (stream) payload.stream = true;
  return payload;
}

async function generateText(params: GenerateParams): Promise<GenerateResult> {
  const apiKey = requireApiKey();
  const model = await resolveModel(params);

  const response = await fetchWithTimeout(
    `${omniRouteConfig.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify(buildPayload(model, params, false)),
    }
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw new AiRateLimitError(
        `OmniRoute chat completion failed: ${describeStatus(response.status)}`,
        parseRetryAfterMs(response)
      );
    }
    throw new Error(
      `OmniRoute chat completion failed: ${describeStatus(response.status)}`
    );
  }

  const raw = (await response.json()) as {
    id: string;
    created: number;
    model: string;
    choices: Array<{
      message: { role: string; content: string | null };
      finish_reason: string | null;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  const choice = raw.choices[0];
  return {
    id: raw.id,
    created: raw.created,
    model: raw.model,
    content: choice?.message.content ?? "",
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

async function* streamText(
  params: GenerateParams
): AsyncGenerator<StreamChunk, void, void> {
  const apiKey = requireApiKey();
  const model = await resolveModel(params);

  const response = await fetch(`${omniRouteConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(buildPayload(model, params, true)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `OmniRoute stream failed: ${describeStatus(response.status)}`
    );
  }

  yield* parseOpenAiSseStream(response.body);
}

async function embed(params: EmbedParams): Promise<EmbedResult> {
  const apiKey = requireApiKey();
  const model = params.model ?? omniRouteConfig.defaultModel;
  if (!model) {
    throw new Error(
      "OmniRoute: embed() needs a model — pass one explicitly or set OMNIROUTE_DEFAULT_MODEL"
    );
  }

  const response = await fetchWithTimeout(
    `${omniRouteConfig.baseUrl}/embeddings`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({ model, input: params.input }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `OmniRoute embeddings failed: ${describeStatus(response.status)}`
    );
  }

  const raw = (await response.json()) as {
    model: string;
    data: Array<{ embedding: number[] }>;
  };

  return {
    embeddings: raw.data.map(item => item.embedding),
    model: raw.model,
  };
}

export const omnirouteProvider: AiProvider = {
  generateText,
  streamText,
  listModels: fetchModels,
  embed,
};
