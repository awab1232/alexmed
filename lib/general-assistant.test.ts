import { describe, expect, it } from "vitest";
import {
  buildGeneralAssistantMessages,
  MAX_HISTORY_TURNS,
} from "./general-assistant";

describe("general assistant prompt", () => {
  it("is friendly, emoji-using, encouraging and not limited to files", () => {
    const [system] = buildGeneralAssistantMessages({
      studentName: "أوس",
      history: [],
      message: "مرحبا",
    });
    const text = String(system.content);
    expect(text).toContain("ANYTHING");
    expect(text).toMatch(/emoji/i);
    expect(text).toMatch(/encouraging/i);
    expect(text).toContain("أوس");
  });

  it("keeps only the recent history and ends with the new message", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content: `turn ${i}`,
    }));
    const messages = buildGeneralAssistantMessages({
      history,
      message: "آخر سؤال",
    });
    expect(messages).toHaveLength(1 + MAX_HISTORY_TURNS + 1);
    expect(messages.at(-1)).toEqual({ role: "user", content: "آخر سؤال" });
    expect(messages[1].content).toBe(`turn ${30 - MAX_HISTORY_TURNS}`);
  });
});
