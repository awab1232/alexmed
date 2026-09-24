import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { candidateModels, omnirouteProvider } from "./omniroute";

const ENV_KEYS = [
  "OMNIROUTE_API_KEY",
  "OMNIROUTE_BASE_URL",
  "OMNIROUTE_DEFAULT_MODEL",
  "OMNIROUTE_FALLBACK_MODELS",
  "OMNIROUTE_VISION_MODEL",
  "OMNIROUTE_VISION_FALLBACK_MODELS",
] as const;

const textMessages = [{ role: "user" as const, content: "hello" }];
const imageMessages = [
  {
    role: "user" as const,
    content: [
      { type: "text" as const, text: "Transcribe this page." },
      {
        type: "image_url" as const,
        image_url: { url: "data:image/png;base64,AAAA" },
      },
    ],
  },
];

function okResponse(model: string) {
  return new Response(
    JSON.stringify({
      id: "x",
      created: 0,
      model,
      choices: [
        {
          message: { role: "assistant", content: "ok" },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200 }
  );
}

describe("OmniRoute vision model chain", () => {
  const saved: Record<string, string | undefined> = {};
  let requestedModels: string[];

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.OMNIROUTE_API_KEY = "test-key";
    process.env.OMNIROUTE_BASE_URL = "https://omni.test/v1";
    process.env.OMNIROUTE_DEFAULT_MODEL = "nvidia/text-main";
    process.env.OMNIROUTE_FALLBACK_MODELS = "nvidia/text-b, nvidia/text-c";
    delete process.env.OMNIROUTE_VISION_MODEL;
    delete process.env.OMNIROUTE_VISION_FALLBACK_MODELS;
    requestedModels = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Every model fails with 503 except `succeedOn`, recording the order tried.
  function stubFetch(succeedOn?: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const model = JSON.parse(String(init.body)).model as string;
        requestedModels.push(model);
        return model === succeedOn
          ? okResponse(model)
          : new Response("down", { status: 503 });
      })
    );
  }

  it("without vision settings, image requests keep today's text chain", () => {
    expect(candidateModels("nvidia/text-main", true)).toEqual([
      "nvidia/text-main",
      "nvidia/text-b",
      "nvidia/text-c",
    ]);
  });

  it("text requests never use the vision chain", async () => {
    process.env.OMNIROUTE_VISION_MODEL = "nvidia/vision-main";
    process.env.OMNIROUTE_VISION_FALLBACK_MODELS = "nvidia/vision-b";
    stubFetch("nvidia/text-main");
    await omnirouteProvider.generateText({
      model: "nvidia/text-main",
      messages: textMessages,
    });
    expect(requestedModels).toEqual(["nvidia/text-main"]);
  });

  it("image requests go to the vision model, then the vision fallbacks", async () => {
    process.env.OMNIROUTE_VISION_MODEL = "nvidia/vision-main";
    process.env.OMNIROUTE_VISION_FALLBACK_MODELS =
      "nvidia/vision-b,nvidia/vision-c";
    stubFetch("nvidia/vision-c");
    const result = await omnirouteProvider.generateText({
      // Call sites pass the resolved default — not a real override.
      model: "nvidia/text-main",
      messages: imageMessages,
    });
    expect(result.model).toBe("nvidia/vision-c");
    expect(requestedModels.filter((m, i, a) => a.indexOf(m) === i)).toEqual([
      "nvidia/vision-main",
      "nvidia/vision-b",
      "nvidia/vision-c",
    ]);
    // A text-only model is never tried for an image.
    expect(requestedModels.some(m => m.startsWith("nvidia/text"))).toBe(false);
  });

  it("an explicit non-default model on an image request is respected", async () => {
    process.env.OMNIROUTE_VISION_MODEL = "nvidia/vision-main";
    stubFetch("gemini/explicit");
    await omnirouteProvider.generateText({
      model: "gemini/explicit",
      messages: imageMessages,
    });
    expect(requestedModels[0]).toBe("gemini/explicit");
  });
});
