import { describe, expect, it } from "vitest";
import { bookDisplayTitle } from "./book-title";
import { resolveAssistantHref } from "@/components/BottomNav";

describe("bookDisplayTitle", () => {
  it("shows a title instead of a file name", () => {
    expect(bookDisplayTitle("qa-physiology.pdf")).toBe("qa-physiology");
    expect(bookDisplayTitle("Family_Medicine_2024.PDF")).toBe(
      "Family Medicine 2024"
    );
    expect(bookDisplayTitle("تشريح الجهاز الهضمي.pdf")).toBe(
      "تشريح الجهاز الهضمي"
    );
  });

  it("never returns an empty title", () => {
    expect(bookDisplayTitle("")).toBe("كتاب بدون عنوان");
    expect(bookDisplayTitle(null)).toBe("كتاب بدون عنوان");
    expect(bookDisplayTitle(".pdf")).toBe(".pdf");
  });
});

describe("resolveAssistantHref", () => {
  it("opens Niro on the book the student is looking at", () => {
    expect(resolveAssistantHref("/books/abc-123")).toBe(
      "/assistant?scope=book&bookId=abc-123"
    );
  });

  it("does not mistake book pages like /books/upload for a book", () => {
    expect(resolveAssistantHref("/books/upload")).toBe("/assistant");
    expect(resolveAssistantHref("/books/stats")).toBe("/assistant");
    expect(resolveAssistantHref("/books/question-files")).toBe("/assistant");
  });

  it("keeps chapter and folder scopes", () => {
    expect(resolveAssistantHref("/books/b1/chapters/c9")).toBe(
      "/assistant?scope=chapter&chapterId=c9"
    );
    expect(resolveAssistantHref("/subjects/s1")).toBe(
      "/assistant?scope=subject&subjectId=s1"
    );
  });
});
