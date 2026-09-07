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
    return (process.env.OMNIROUTE_FALLBACK_MODELS ?? "")
      .split(",")
      .map(model => model.trim())
      .filter(Boolean);
  },
};

export const openRouterConfig = {
  get apiKey() {
    return process.env.OPENROUTER_API_KEY?.trim() || undefined;
  },
};
