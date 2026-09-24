import { describe, expect, it } from "vitest";
import {
  allowSelectionAssistantRequest,
  buildSelectionAssistantMessages,
} from "./selection-assistant";

describe("selection assistant", () => {
  it("grounds the prompt in the selected text and its whole page", () => {
    const messages = buildSelectionAssistantMessages({
      fileName: "Gyn.pdf",
      pageNumber: 35,
      pageText: "Full page 35 text about the Alvarado score.",
      selectedText: "Alvarado score",
      action: "explain",
    });
    const context = String(messages[1].content);
    expect(context).toContain("page 35");
    expect(context).toContain("Full page 35 text about the Alvarado score.");
    expect(context).toContain('"""Alvarado score"""');
    expect(String(messages.at(-1)!.content)).toMatch(/Explain the selected/);
  });

  it("uses the student's own question and keeps follow-up history", () => {
    const messages = buildSelectionAssistantMessages({
      fileName: "x.pdf",
      pageNumber: 2,
      pageText: "p",
      selectedText: "s",
      action: "ask",
      question: "ليش هذا مهم؟",
      history: [
        { role: "user", content: "اشرح ببساطة" },
        { role: "assistant", content: "شرح سابق" },
      ],
    });
    expect(messages.map(m => m.content)).toContain("شرح سابق");
    expect(String(messages.at(-1)!.content)).toContain("ليش هذا مهم؟");
  });

  it("rate-limits one user without affecting others", () => {
    const now = 1_000_000;
    for (let i = 0; i < 40; i++) {
      expect(allowSelectionAssistantRequest("u-limit", now + i)).toBe(true);
    }
    expect(allowSelectionAssistantRequest("u-limit", now + 50)).toBe(false);
    expect(allowSelectionAssistantRequest("u-other", now + 50)).toBe(true);
    // The window slides: 10 minutes later the user can ask again.
    expect(allowSelectionAssistantRequest("u-limit", now + 11 * 60_000)).toBe(
      true
    );
  });
});
