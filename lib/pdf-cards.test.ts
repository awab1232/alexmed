import { describe, expect, it } from "vitest";
import { normalizePageText } from "./pdf-cards";

describe("normalizePageText", () => {
  it("normalizes extracted page text without changing its meaning", () => {
    expect(
      normalizePageText(
        "  Question   one  \n\n\n Answer" + String.fromCharCode(0) + "  "
      )
    ).toBe("Question   one\n\n Answer");
  });
});
