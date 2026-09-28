import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi
    .fn()
    .mockResolvedValue("https://signed.example/question-files/b/p1.png?sig=x"),
}));

import { streamStoredObject } from "./storage-stream";

describe("streamStoredObject", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("proxies the bytes with the caller's cache policy and never exposes the signed URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("PNGDATA", {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "7" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await streamStoredObject(
      "question-files/b/p1.png",
      new Request("http://localhost/x"),
      { cacheControl: "private, no-store" }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("location")).toBeNull();
    const headerDump = JSON.stringify([...response.headers.entries()]);
    expect(headerDump).not.toContain("signed.example");
    expect(await response.text()).toBe("PNGDATA");
  });

  it("answers 502 (not the upstream body) when storage fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("denied", { status: 403 }))
    );
    const response = await streamStoredObject(
      "k",
      new Request("http://localhost/x"),
      { cacheControl: "private, no-store" }
    );
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("denied");
  });
});
