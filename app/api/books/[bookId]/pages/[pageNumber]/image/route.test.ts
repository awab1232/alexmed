import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db-books", () => ({ getBookPageForUser: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi
    .fn()
    .mockResolvedValue("https://signed.example/img.png"),
}));

import { auth } from "@/lib/auth";
import { getBookPageForUser } from "@/lib/db-books";
import { GET } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetPage = getBookPageForUser as unknown as ReturnType<typeof vi.fn>;

function paramsFor(bookId: string, pageNumber: string) {
  return { params: Promise.resolve({ bookId, pageNumber }) };
}

describe("GET /api/books/[bookId]/pages/[pageNumber]/image", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockGetPage.mockReset();
  });

  it("rejects an unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await GET(
      new Request("https://app.example.com"),
      paramsFor("b1", "1")
    );
    expect(response.status).toBe(401);
    expect(mockGetPage).not.toHaveBeenCalled();
  });

  // Never leaks whether a page/book belonging to a different user even
  // exists — getBookPageForUser's ownership join returning null looks
  // identical whether the id is wrong or just not owned by this caller.
  it("returns 404 for a page belonging to a book the caller does not own", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetPage.mockResolvedValue(null); // ownership join found nothing

    const response = await GET(
      new Request("https://app.example.com"),
      paramsFor("someone-elses-book", "1")
    );

    expect(response.status).toBe(404);
    expect(mockGetPage).toHaveBeenCalledWith("u1", "someone-elses-book", 1);
  });

  it("redirects to a signed URL for a page the caller owns", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetPage.mockResolvedValue({
      page: { id: "p1", storageKey: "book-pages/b1/1.png" },
      visuals: [],
    });

    const response = await GET(
      new Request("https://app.example.com"),
      paramsFor("b1", "1")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://signed.example/img.png"
    );
  });

  it("rejects a non-numeric page number before touching the database", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const response = await GET(
      new Request("https://app.example.com"),
      paramsFor("b1", "not-a-number")
    );
    expect(response.status).toBe(400);
    expect(mockGetPage).not.toHaveBeenCalled();
  });
});
