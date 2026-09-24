import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db-file-access", () => ({
  isFileKeyAccessibleToUser: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi
    .fn()
    .mockResolvedValue("https://signed.example/file.pdf"),
}));

import { auth } from "@/lib/auth";
import { isFileKeyAccessibleToUser } from "@/lib/db-file-access";
import { GET } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockAllowed = isFileKeyAccessibleToUser as unknown as ReturnType<
  typeof vi.fn
>;

function requestFor(key: string[]) {
  return GET(new Request("http://localhost/api/files/" + key.join("/")), {
    params: Promise.resolve({ key }),
  });
}

describe("GET /api/files/[...key]", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAllowed.mockReset();
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@example.com" } });
  });

  it("rejects an unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await requestFor(["study-pdfs", "a.pdf"]);
    expect(response.status).toBe(401);
    expect(mockAllowed).not.toHaveBeenCalled();
  });

  // Never leaks whether a key belonging to a different user's book/deck/job
  // even exists — a wrong key and someone else's real key look identical.
  it("returns 404 for a key the caller is not authorized to read", async () => {
    mockAllowed.mockResolvedValue(false);
    const response = await requestFor(["book-pdfs", "someone-elses.pdf"]);
    expect(response.status).toBe(404);
    expect(mockAllowed).toHaveBeenCalledWith(
      "u1",
      "book-pdfs/someone-elses.pdf"
    );
  });

  it("redirects to a signed URL for a key the caller is authorized to read", async () => {
    mockAllowed.mockResolvedValue(true);
    const response = await requestFor(["book-pdfs", "mine.pdf"]);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://signed.example/file.pdf"
    );
  });
});

// ?stream=1: same-origin byte-range proxy for the PDF reader (storage sends
// no CORS headers on Range responses, so the browser can't range-request it).
describe("GET /api/files/[...key]?stream=1", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAllowed.mockReset();
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@example.com" } });
  });

  function streamRequest(key: string[], range?: string) {
    return GET(
      new Request(`http://localhost/api/files/${key.join("/")}?stream=1`, {
        headers: range ? { Range: range } : undefined,
      }),
      { params: Promise.resolve({ key }) }
    );
  }

  it("forwards the Range header and returns 206 with range headers", async () => {
    mockAllowed.mockResolvedValue(true);
    const fetchMock = vi.fn(
      async () =>
        new Response("x".repeat(1024), {
          status: 206,
          headers: {
            "content-type": "application/pdf",
            "content-length": "1024",
            "content-range": "bytes 0-1023/50853984",
          },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await streamRequest(
      ["study-pdfs", "a.pdf"],
      "bytes=0-1023"
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 0-1023/50853984");
    expect(response.headers.get("content-length")).toBe("1024");
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect((init.headers as Record<string, string>).Range).toBe("bytes=0-1023");
    vi.unstubAllGlobals();
  });

  it("still enforces ownership before streaming anything", async () => {
    mockAllowed.mockResolvedValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await streamRequest(["study-pdfs", "someone-else.pdf"]);
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
