// Shared request/response shapes for the AI gateway (lib/ai/gateway.ts) and
// its providers (lib/ai/providers/*). Field names match what the OpenAI-
// compatible chat-completions API speaks, since every provider here is one.

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

export type GenerateParams = {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  responseFormat?: ResponseFormat;
};

export type GenerateResult = {
  id: string;
  created: number;
  model: string;
  content: string;
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export type StreamChunk = { delta: string; done: boolean };

export type ModelInfo = {
  id: string;
  name: string;
  isFree: boolean;
  supportsImages: boolean;
  contextLength: number;
};

export type EmbedParams = { input: string | string[]; model?: string };
export type EmbedResult = { embeddings: number[][]; model: string };

// Thrown by a provider when the upstream gateway/model returns 429, so route
// handlers can tell "genuinely rate-limited, worth waiting and retrying" apart
// from other failures (bad request, provider outage, ...) instead of treating
// every invokeLLM() failure the same way.
export class AiRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(message: string, retryAfterMs = 20_000) {
    super(message);
    this.name = "AiRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export interface AiProvider {
  generateText(params: GenerateParams): Promise<GenerateResult>;
  streamText(params: GenerateParams): AsyncGenerator<StreamChunk, void, void>;
  listModels(): Promise<ModelInfo[]>;
  /** Not every OpenAI-compatible gateway implements embeddings — optional. */
  embed?(params: EmbedParams): Promise<EmbedResult>;
}
