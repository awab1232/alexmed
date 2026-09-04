import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/omniroute", () => ({
  omnirouteProvider: {
    generateText: vi.fn(async () => ({
      id: "omni-1",
      created: 0,
      model: "omni-model",
      content: "from omniroute",
      finishReason: "stop",
    })),
    streamText: vi.fn(),
    listModels: vi.fn(async () => []),
  },
}));

vi.mock("./providers/openrouter", () => ({
  openrouterProvider: {
    generateText: vi.fn(async () => ({
      id: "or-1",
      created: 0,
      model: "or-model",
      content: "from openrouter",
      finishReason: "stop",
    })),
    streamText: vi.fn(),
    listModels: vi.fn(async () => []),
  },
  DEFAULT_TEXT_MODEL: "openrouter/free",
  DEFAULT_VISION_MODEL: "openrouter/free",
}));

import { generateText } from "./gateway";
import { omnirouteProvider } from "./providers/omniroute";
import { openrouterProvider } from "./providers/openrouter";
import { AiRateLimitError } from "./types";

describe("gateway provider selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes to OmniRoute when it's the active provider", async () => {
    vi.stubEnv("LLM_PROVIDER", "omniroute");
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");

    const result = await generateText({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.content).toBe("from omniroute");
    expect(omnirouteProvider.generateText).toHaveBeenCalled();
    expect(openrouterProvider.generateText).not.toHaveBeenCalled();
  });

  it("routes to OpenRouter when OmniRoute isn't configured", async () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("OMNIROUTE_API_KEY", "");

    const result = await generateText({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.content).toBe("from openrouter");
    expect(openrouterProvider.generateText).toHaveBeenCalled();
  });

  it("fails over to OpenRouter when OmniRoute fails and an OpenRouter key is configured", async () => {
    vi.stubEnv("LLM_PROVIDER", "omniroute");
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_API_KEY", "or-test-key");
    vi.mocked(omnirouteProvider.generateText).mockRejectedValueOnce(
      new Error(
        "OmniRoute chat completion failed: OmniRoute or upstream provider unavailable"
      )
    );

    const result = await generateText({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.content).toBe("from openrouter");
    expect(openrouterProvider.generateText).toHaveBeenCalled();
  });

  it("does not fail over on a 429 rate-limit error", async () => {
    vi.stubEnv("LLM_PROVIDER", "omniroute");
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_API_KEY", "or-test-key");
    vi.mocked(omnirouteProvider.generateText).mockRejectedValueOnce(
      new AiRateLimitError("rate limited", 5000)
    );

    await expect(
      generateText({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toBeInstanceOf(AiRateLimitError);
    expect(openrouterProvider.generateText).not.toHaveBeenCalled();
  });
});
