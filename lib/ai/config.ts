// Single place that reads AI-related env vars, so no other file in the
// codebase touches these `process.env.*` names directly.
export type ProviderName = "omniroute" | "openrouter";

export function resolveProvider(): ProviderName {
  const configured = process.env.LLM_PROVIDER?.trim().toLowerCase();

  if (configured === "omniroute") {
    if (!process.env.OMNIROUTE_API_KEY) {
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
  return process.env.OMNIROUTE_API_KEY ? "omniroute" : "openrouter";
}

export const omniRouteConfig = {
  get baseUrl() {
    return (
      process.env.OMNIROUTE_BASE_URL ||
      "https://omniroute-noodeenv.up.railway.app/v1"
    ).replace(/\/+$/, "");
  },
  get apiKey() {
    return process.env.OMNIROUTE_API_KEY;
  },
  get defaultModel() {
    return process.env.OMNIROUTE_DEFAULT_MODEL?.trim() || undefined;
  },
};

export const openRouterConfig = {
  get apiKey() {
    return process.env.OPENROUTER_API_KEY;
  },
};
