import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/files/[...key]", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@example.com" } });
  });

  it("rejects an unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/files/study-pdfs/a.pdf"), {
      params: Promise.resolve({ key: ["study-pdfs", "a.pdf"] }),
    });
    expect(response.status).toBe(401);
  });
});
