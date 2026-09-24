import { describe, expect, it } from "vitest";
import { pickStalledBookChapters, STALLED_BOOK_CHAPTER_MS } from "./db-books";

const NOW = Date.parse("2026-09-25T12:00:00Z");
const cutoff = new Date(NOW - 20 * 60 * 1000);
const ago = (ms: number) => new Date(NOW - ms);
const row = (
  id: string,
  status: string,
  updatedMsAgo: number,
  startedMsAgo: number | null = null
) => ({
  id,
  status,
  updatedAt: ago(updatedMsAgo),
  lastStartedAt: startedMsAgo === null ? null : ago(startedMsAgo),
});

describe("pickStalledBookChapters", () => {
  it("never touches a book whose analysis the student hasn't started", () => {
    expect(
      pickStalledBookChapters(
        [row("a", "pending", 3_600_000), row("b", "pending", 3_600_000)],
        cutoff,
        NOW
      )
    ).toEqual([]);
  });

  // The reported case: part 1 done, parts 2-3 left with no queue message.
  it("re-queues idle pending/retrying parts of a started book", () => {
    const idle = STALLED_BOOK_CHAPTER_MS + 1000;
    expect(
      pickStalledBookChapters(
        [
          row("p1", "complete", idle),
          row("p2", "retrying", idle),
          row("p3", "pending", idle),
        ],
        cutoff,
        NOW
      )
    ).toEqual([{ id: "p2" }, { id: "p3" }]);
  });

  it("leaves recently-touched parts alone (a live wait loop)", () => {
    expect(
      pickStalledBookChapters(
        [row("p1", "complete", 60_000), row("p2", "retrying", 30_000)],
        cutoff,
        NOW
      )
    ).toEqual([]);
  });

  it("re-queues only processing parts abandoned past the cutoff", () => {
    expect(
      pickStalledBookChapters(
        [
          row("live", "processing", 0, 5 * 60 * 1000),
          row("dead", "processing", 0, 25 * 60 * 1000),
        ],
        cutoff,
        NOW
      )
    ).toEqual([{ id: "dead" }]);
  });
});
