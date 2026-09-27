import { describe, expect, it } from "vitest";
import { isOwnUploadKey, newUploadKey } from "./upload-keys";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";

describe("upload keys", () => {
  it("issues keys under the uploader's id and accepts them back", () => {
    const key = newUploadKey("book-pdfs", alice, "My Book (1).pdf");
    expect(key).toMatch(
      new RegExp(`^book-pdfs/${alice}/[0-9a-f-]{36}-My_Book__1_.pdf$`)
    );
    expect(isOwnUploadKey(key, alice)).toBe(true);
    expect(isOwnUploadKey(key, alice, "book-pdfs")).toBe(true);
  });

  it("refuses another user's key", () => {
    const key = newUploadKey("study-pdfs", alice, "a.pdf");
    expect(isOwnUploadKey(key, bob)).toBe(false);
  });

  it("refuses the wrong prefix when one is required", () => {
    const key = newUploadKey("study-pdfs", alice, "a.pdf");
    expect(isOwnUploadKey(key, alice, "book-pdfs")).toBe(false);
  });

  it("refuses old-format, foreign-prefix and path-trick keys", () => {
    for (const key of [
      "book-pdfs/0f8fad5b-d9cb-469f-a165-70867728950e-a.pdf",
      `admin-materials/${alice}/0f8fad5b-d9cb-469f-a165-70867728950e-a.pdf`,
      `book-pages/${alice}/0f8fad5b-d9cb-469f-a165-70867728950e-a.pdf`,
      `book-pdfs/${alice}/../${bob}/0f8fad5b-d9cb-469f-a165-70867728950e-a.pdf`,
      `book-pdfs/${alice}/0f8fad5b-d9cb-469f-a165-70867728950e-a/b.pdf`,
      `book-pdfs/${alice}/x-a.pdf`,
      "",
    ]) {
      expect(isOwnUploadKey(key, alice)).toBe(false);
    }
  });
});
