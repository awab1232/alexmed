import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db-books", () => ({ getBookPageForUser: vi.fn() }));
vi.mock("@/lib/book-access", () => ({ getBookAccess: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  storageGetSignedUrl: vi
    .fn()
    .mockResolvedValue("https://signed.example/img.png"),
}));

import { auth } from "@/lib/auth";
import { getBookAccess } from "@/lib/book-access";
import { getBookPageForUser } from "@/lib/db-books";
import { GET } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetPage = getBookPageForUser as unknown as ReturnType<typeof vi.fn>;
const mockAccess = getBookAccess as unknown as ReturnType<typeof vi.fn>;

const ownerAccess = {
  bookId: "b1",
  ownerId: "u1",
  role: "owner",
  ownerName: null,
  ownerUsername: null,
};

function paramsFor(bookId: string, pageNumber: string) {
  return { params: Promise.resolve({ bookId, pageNumber }) };
}

describe("GET /api/books/[bookId]/pages/[pageNumber]/image", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockGetPage.mockReset();
    mockAccess.mockReset();
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
  // exists — no access (not owner, no accepted share — incl. a revoked
  // one) looks identical whether the id is wrong or just not theirs.
  it("returns 404 for a page belonging to a book the caller can't access", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockAccess.mockResolvedValue(null);

    const response = await GET(
      new Request("https://app.example.com"),
      paramsFor("someone-elses-book", "1")
    );

    expect(response.status).toBe(404);
    expect(mockAccess).toHaveBeenCalledWith("u1", "someone-elses-book");
    expect(mockGetPage).not.toHaveBeenCalled();
  });

  it("serves an accepted share recipient the owner's page", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2" } });
    mockAccess.mockResolvedValue({ ...ownerAccess, role: "shared" });
    mockGetPage.mockResolvedValue({
      page: { id: "p1", storageKey: "book-pages/b1/1.png" },
      visuals: [],
    });

    const response = await GET(
      new Request("https://app.example.com"),
      paramsFor("b1", "1")
    );

    expect(response.status).toBe(307);
    // Read through the OWNER's scope — never the recipient's own id.
    expect(mockGetPage).toHaveBeenCalledWith("u1", "b1", 1);
  });

  it("redirects to a signed URL for a page the caller owns", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockAccess.mockResolvedValue(ownerAccess);
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
