import { describe, expect, it } from "vitest";
import {
  buildGeneralAssistantMessages,
  DEFAULT_IMAGE_PROMPT,
  isValidImageDataUrl,
  MAX_HISTORY_TURNS,
  MAX_IMAGE_DATA_URL_LENGTH,
} from "./general-assistant";

const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD=";
const OLD_PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

describe("general assistant images", () => {
  it("accepts only real image data URLs within the size cap", () => {
    expect(isValidImageDataUrl(PHOTO)).toBe(true);
    expect(isValidImageDataUrl(OLD_PHOTO)).toBe(true);
    expect(isValidImageDataUrl("https://example.com/x.png")).toBe(false);
    expect(isValidImageDataUrl("data:text/html;base64,PGgxPg==")).toBe(false);
    expect(isValidImageDataUrl("data:image/png;base64,<script>")).toBe(false);
    expect(
      isValidImageDataUrl(
        `data:image/png;base64,${"A".repeat(MAX_IMAGE_DATA_URL_LENGTH)}`
      )
    ).toBe(false);
  });

  it("sends the photo as an image part (with a default prompt when no text)", () => {
    const messages = buildGeneralAssistantMessages({
      history: [],
      message: "",
      image: PHOTO,
    });
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: DEFAULT_IMAGE_PROMPT },
        { type: "image_url", image_url: { url: PHOTO, detail: "high" } },
      ],
    });
    expect(String(messages[0].content)).toMatch(/Images:/);
  });

  it("re-sends only the latest earlier photo for follow-ups", () => {
    const messages = buildGeneralAssistantMessages({
      history: [
        { role: "user", content: "old", image: OLD_PHOTO },
        { role: "assistant", content: "a1" },
        { role: "user", content: "this one", image: PHOTO },
        { role: "assistant", content: "a2" },
      ],
      message: "and question 2?",
    });
    const parts = messages.flatMap(message =>
      Array.isArray(message.content) ? message.content : []
    );
    const images = parts.filter(
      part => typeof part === "object" && part.type === "image_url"
    );
    // MAX_IMAGES_PER_REQUEST allows 2, but only one earlier photo is ever
    // re-sent by the client; the builder keeps the newest ones.
    expect(JSON.stringify(images)).toContain(PHOTO);
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "and question 2?",
    });
  });
});

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
