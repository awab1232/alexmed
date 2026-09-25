import { describe, expect, it } from "vitest";
import { applyOwnProgress, decideAccess, shareSafeBook } from "./book-access";
import {
  checkShareRequest,
  normalizeUsername,
  RESEND_AFTER_DECLINE_MS,
  shareRequestMessage,
  validateUsername,
} from "./db-sharing";

// 📤 Pure rules behind Study Pack sharing — who may read a book, how a
// recipient's progress replaces the owner's, and which share requests are
// allowed.

const row = (ownerId: string, shared: boolean) => ({
  bookId: "b1",
  ownerId,
  shared,
  ownerName: "Owner",
  ownerUsername: "owner",
});

describe("decideAccess — Owner OR Accepted Share", () => {
  it("owner", () => {
    expect(decideAccess("a", row("a", false))?.role).toBe("owner");
  });
  it("accepted share recipient", () => {
    const access = decideAccess("b", row("a", true));
    expect(access?.role).toBe("shared");
    expect(access?.ownerId).toBe("a");
  });
  it("anyone else (no/pending/declined/revoked/removed share)", () => {
    expect(decideAccess("c", row("a", false))).toBeNull();
  });
  it("missing book", () => {
    expect(decideAccess("a", undefined)).toBeNull();
  });
});

describe("shareSafeBook", () => {
  const book = { id: "b1", subjectId: "owner-folder" };
  it("hides the owner's folder from a recipient", () => {
    expect(
      shareSafeBook(book, decideAccess("b", row("a", true))!).subjectId
    ).toBeNull();
  });
  it("leaves the owner's book untouched", () => {
    expect(
      shareSafeBook(book, decideAccess("a", row("a", false))!).subjectId
    ).toBe("owner-folder");
  });
});

describe("applyOwnProgress — personal progress stays separate", () => {
  const created = new Date("2026-01-01T00:00:00Z");
  const ownerReviewed = new Date("2026-02-01T00:00:00Z");
  const card = (id: string) => ({
    id,
    userId: "owner",
    createdAt: created,
    easeFactor: 2.1,
    intervalDays: 30,
    dueAt: new Date("2026-03-01T00:00:00Z"),
    reviewCount: 9,
    lastRating: "easy" as const,
    fsrsStability: 40,
    fsrsDifficulty: 3,
    lastReviewedAt: ownerReviewed,
    questionEn: `Q ${id}`,
  });

  it("a recipient with no reviews sees fresh cards, not the owner's state", () => {
    const [mine] = applyOwnProgress([card("c1")], "viewer", []);
    expect(mine).toMatchObject({
      userId: "viewer",
      reviewCount: 0,
      intervalDays: 0,
      lastRating: null,
      fsrsStability: null,
      lastReviewedAt: null,
      dueAt: created,
      questionEn: "Q c1",
    });
  });

  it("a recipient sees exactly their own progress per card", () => {
    const due = new Date("2026-04-02T00:00:00Z");
    const [c1, c2] = applyOwnProgress([card("c1"), card("c2")], "viewer", [
      {
        cardId: "c2",
        intervalDays: 3,
        dueAt: due,
        reviewCount: 1,
        lastRating: "good",
        fsrsStability: 2.5,
        fsrsDifficulty: 5,
        lastReviewedAt: created,
      },
    ]);
    expect(c1.reviewCount).toBe(0);
    expect(c2).toMatchObject({ reviewCount: 1, dueAt: due, intervalDays: 3 });
  });
});

describe("usernames", () => {
  it("normalises case, whitespace and a leading @", () => {
    expect(normalizeUsername("  @Sara.Med ")).toBe("sara.med");
  });
  it.each(["sara", "sara_22", "med.student", "a1b"])("accepts %s", name => {
    expect(validateUsername(name)).toBe(name);
  });
  it.each(["ab", "_sara", "sara..x", "سارة", "sara@x.com", "a".repeat(25)])(
    "rejects %s",
    name => {
      expect(validateUsername(name)).toBeNull();
    }
  );
});

describe("checkShareRequest", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  const base = {
    ownerId: "a",
    recipientId: "b",
    blocked: false,
    liveStatus: null,
    lastDeclinedAt: null,
    now,
  };

  it("allows a first request", () => {
    expect(checkShareRequest(base)).toBeNull();
  });
  it("no self-share", () => {
    expect(checkShareRequest({ ...base, recipientId: "a" })).toBe("SELF_SHARE");
  });
  it("duplicate pending request", () => {
    expect(checkShareRequest({ ...base, liveStatus: "pending" })).toBe(
      "ALREADY_PENDING"
    );
    expect(shareRequestMessage("ALREADY_PENDING", "")).toContain(
      "بانتظار الرد"
    );
  });
  it("already has access", () => {
    expect(checkShareRequest({ ...base, liveStatus: "accepted" })).toBe(
      "ALREADY_SHARED"
    );
    expect(shareRequestMessage("ALREADY_SHARED", "Sara")).toBe(
      "Sara لديه وصول لهذا الملف بالفعل."
    );
  });
  it("blocked in either direction", () => {
    expect(checkShareRequest({ ...base, blocked: true })).toBe("BLOCKED");
  });
  it("resend after decline only once the cooldown has passed", () => {
    const justNow = new Date(now.getTime() - 60_000);
    const longAgo = new Date(now.getTime() - RESEND_AFTER_DECLINE_MS - 1);
    expect(checkShareRequest({ ...base, lastDeclinedAt: justNow })).toBe(
      "RECENTLY_DECLINED"
    );
    expect(checkShareRequest({ ...base, lastDeclinedAt: longAgo })).toBeNull();
  });
});
