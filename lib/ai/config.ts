// Single place that reads AI-related env vars, so no other file in the
// codebase touches these `process.env.*` names directly.
export type ProviderName = "omniroute" | "openrouter";

export function resolveProvider(): ProviderName {
  const configured = process.env.LLM_PROVIDER?.trim().toLowerCase();

  if (configured === "omniroute") {
    if (!omniRouteConfig.apiKey) {
      console.warn(
        "[AI] LLM_PROVIDER=omniroute but OMNIROUTE_API_KEY is missing — falling back to openrouter"
      );
      return "openrouter";
    }
    return "omniroute";
  }

  if (configured === "openrouter") return "openrouter";

  // LLM_PROVIDER unset/unrecognized: prefer OmniRoute as the default AI
  // gateway once it's configured, otherwise keep the existing OpenRouter path.
  return omniRouteConfig.apiKey ? "omniroute" : "openrouter";
}

export const omniRouteConfig = {
  get baseUrl() {
    return (
      process.env.OMNIROUTE_BASE_URL ||
      "https://omniroute-noodeenv.up.railway.app/v1"
    ).replace(/\/+$/, "");
  },
  get apiKey() {
    return process.env.OMNIROUTE_API_KEY?.trim() || undefined;
  },
  get defaultModel() {
    return process.env.OMNIROUTE_DEFAULT_MODEL?.trim() || undefined;
  },
  // Comma-separated concrete model ids tried in order, after defaultModel,
  // when a call has no explicit model and the previous one fails — OmniRoute's
  // own "auto/*" routing has been observed picking a provider with no active
  // credentials for vision requests, so falling back to another "auto/*"
  // alias wouldn't help; these need to be concrete provider/model ids.
  get fallbackModels() {
    return parseModelList(process.env.OMNIROUTE_FALLBACK_MODELS);
  },
  // Separate chain for requests that carry an image (OCR, page-visual
  // analysis, question-image classification). Many strong text models are
  // text-only — measured 2026-09-24: grok-cli/*, nemotron-3-super, glm-5.3
  // and gpt-oss-20b all ignore or reject images — so letting the text
  // default also serve images makes OCR fail (or silently read nothing).
  // Unset = today's behavior (images use the text chain).
  get visionModel() {
    return process.env.OMNIROUTE_VISION_MODEL?.trim() || undefined;
  },
  get visionFallbackModels() {
    return parseModelList(process.env.OMNIROUTE_VISION_FALLBACK_MODELS);
  },
  // Fast, cheap text model for short interactive answers (the PDF reader's
  // "اسأل AI" on selected text) — e.g. grok-cli/grok-4.6: fast and free but
  // text-only and slow on very long generations, so it's NOT the default
  // for chapter analysis. Its failures still fall back through
  // OMNIROUTE_FALLBACK_MODELS. Unset = the default model.
  get fastTextModel() {
    return process.env.OMNIROUTE_FAST_TEXT_MODEL?.trim() || undefined;
  },
};

function parseModelList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean);
}

export const openRouterConfig = {
  get apiKey() {
    return process.env.OPENROUTER_API_KEY?.trim() || undefined;
  },
};
