import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveProvider } from "./config";

describe("resolveProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to openrouter when nothing is configured", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("OMNIROUTE_API_KEY", "");
    expect(resolveProvider()).toBe("openrouter");
  });

  it("defaults to omniroute once its key is present and LLM_PROVIDER is unset", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");
    expect(resolveProvider()).toBe("omniroute");
  });

  it("respects an explicit LLM_PROVIDER=openrouter even if OmniRoute is configured", () => {
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");
    expect(resolveProvider()).toBe("openrouter");
  });

  it("falls back to openrouter if LLM_PROVIDER=omniroute but no key is set", () => {
    vi.stubEnv("LLM_PROVIDER", "omniroute");
    vi.stubEnv("OMNIROUTE_API_KEY", "");
    expect(resolveProvider()).toBe("openrouter");
  });

  it("honors an explicit LLM_PROVIDER=omniroute when the key is present", () => {
    vi.stubEnv("LLM_PROVIDER", "omniroute");
    vi.stubEnv("OMNIROUTE_API_KEY", "test-key");
    expect(resolveProvider()).toBe("omniroute");
  });
});
