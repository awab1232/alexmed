import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, canonicalHostRedirect } from "./canonical-host";

describe("canonicalHostRedirect", () => {
  it("permanently canonicalizes only the production www alias", () => {
    expect(
      canonicalHostRedirect(
        new URL("https://www.nirolearn.com/pdf-summary?source=search#faq")
      )?.toString()
    ).toBe(`${CANONICAL_ORIGIN}/pdf-summary?source=search`);
  });

  it("does not redirect canonical, preview, Railway, or local hosts", () => {
    for (const value of [
      "https://nirolearn.com/pricing",
      "https://nirolearn-staging.up.railway.app/pricing",
      "http://localhost:3000/pricing",
    ]) {
      expect(canonicalHostRedirect(new URL(value))).toBeNull();
    }
  });
});
