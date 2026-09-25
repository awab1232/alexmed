import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./rag", async importOriginal => ({
  ...(await importOriginal<typeof import("./rag")>()),
  getPageChunk: vi.fn(),
  getScopeOverview: vi.fn(),
  searchBookPages: vi.fn(),
  searchChapterPages: vi.fn(),
  searchSubjectPages: vi.fn(),
}));
vi.mock("./db-chat", () => ({ listChatMessages: vi.fn() }));
vi.mock("./llm", async importOriginal => ({
  ...(await importOriginal<typeof import("./llm")>()),
  invokeLLM: vi.fn(),
}));

import { listChatMessages } from "./db-chat";
import { invokeLLM } from "./llm";
import { getScopeOverview, searchBookPages } from "./rag";
import { prepareStudyChatTurn } from "./study-chat";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const session = {
  id: "s1",
  userId: "u1",
  scope: "book",
  bookId: "b1",
  chapterId: null,
  pageId: null,
  subjectId: null,
} as never;

const page2 = {
  bookId: "b1",
  bookFileName: "Cardio.pdf",
  chapterId: "c1",
  pageNumber: 2,
  text: "The Frank-Starling law states that increased preload increases stroke volume.",
};

beforeEach(() => {
  vi.clearAllMocks();
  m(getScopeOverview).mockResolvedValue("File: Cardio.pdf");
  m(listChatMessages).mockResolvedValue([
    { role: "user", content: "سؤال سابق" },
    { role: "assistant", content: "جواب سابق" },
    { role: "user", content: "the current question" },
  ]);
});

describe("prepareStudyChatTurn", () => {
  it("finds English pages for an Arabic question via English search terms", async () => {
    m(searchBookPages).mockImplementation(async (_id: string, q: string) =>
      /starling/i.test(q) ? [page2] : []
    );
    m(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "Frank-Starling law preload" } }],
    });
    const { chunks, messages } = await prepareStudyChatTurn(
      "u1",
      session,
      "ما هو قانون فرانك ستارلنج؟"
    );
    expect(searchBookPages).toHaveBeenNthCalledWith(
      2,
      "b1",
      "Frank-Starling law preload"
    );
    expect(chunks).toEqual([page2]);
    const last = String(messages.at(-1)!.content);
    expect(last).toContain("صفحة 2");
    expect(last).toContain("QUESTION: ما هو قانون فرانك ستارلنج؟");
    // History without the just-appended question, then the context turn.
    expect(messages.map(message => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
  });

  it("doesn't spend an extra call when the question already matched", async () => {
    m(searchBookPages).mockResolvedValue([page2]);
    await prepareStudyChatTurn("u1", session, "Frank-Starling law?");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("still answers (overview only) when nothing matches or expansion fails", async () => {
    m(searchBookPages).mockResolvedValue([]);
    m(invokeLLM).mockRejectedValue(new Error("model down"));
    const { chunks, messages } = await prepareStudyChatTurn(
      "u1",
      session,
      "شو أحسن طريقة للمذاكرة؟"
    );
    expect(chunks).toEqual([]);
    const last = String(messages.at(-1)!.content);
    expect(last).toContain("MATERIAL OVERVIEW:\nFile: Cardio.pdf");
    expect(last).toMatch(/none of the file's pages matched/);
  });
});
