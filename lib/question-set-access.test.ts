import { describe, expect, it } from "vitest";
import {
  decideQuestionSetAccess,
  type QuestionSetAccessRow,
} from "./question-set-access";

const row: QuestionSetAccessRow = {
  setId: "set",
  bookId: "book",
  ownerId: "doctor",
  status: "published",
  windowOpen: true,
  doctorActive: true,
  entitlementId: "ent",
};

const student = { id: "student" };

describe("decideQuestionSetAccess", () => {
  it("lets an entitled student in only when every condition holds", () => {
    expect(decideQuestionSetAccess(student, row)).toEqual({
      role: "entitled",
      setId: "set",
      bookId: "book",
      entitlementId: "ent",
    });
  });

  it.each<[string, Partial<QuestionSetAccessRow>]>([
    [
      "no active entitlement (never had one, or revoked)",
      { entitlementId: null },
    ],
    ["a draft", { status: "draft" }],
    ["disabled (kill switch)", { status: "disabled" }],
    ["archived", { status: "archived" }],
    ["outside the start/end window", { windowOpen: false }],
    ["its doctor suspended / not approved", { doctorActive: false }],
  ])("refuses a student when the set is %s", (_label, change) => {
    expect(decideQuestionSetAccess(student, { ...row, ...change })).toBeNull();
  });

  it("refuses when there's no such set", () => {
    expect(decideQuestionSetAccess(student, undefined)).toBeNull();
  });

  it("lets the owner preview any status, only while approved", () => {
    const owner = { id: "doctor" };
    for (const status of [
      "draft",
      "published",
      "disabled",
      "archived",
    ] as const) {
      expect(
        decideQuestionSetAccess(owner, {
          ...row,
          status,
          windowOpen: false,
          entitlementId: null,
        })?.role
      ).toBe("owner");
    }
    expect(
      decideQuestionSetAccess(owner, { ...row, doctorActive: false })
    ).toBeNull();
  });

  it("lets an admin in regardless (moderation), without a watermark identity", () => {
    expect(
      decideQuestionSetAccess(
        { id: "admin", role: "admin" },
        { ...row, status: "disabled", entitlementId: null }
      )
    ).toMatchObject({ role: "admin", entitlementId: null });
  });

  it("never treats a non-admin role string as admin", () => {
    expect(
      decideQuestionSetAccess(
        { id: "x", role: "user" },
        { ...row, entitlementId: null }
      )
    ).toBeNull();
  });
});
