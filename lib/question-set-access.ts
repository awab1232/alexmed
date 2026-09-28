// 🔒 The ONE authorization rule for reading a protected question set (its
// questions, images, title). Every protected read calls getQuestionSetAccess
// once per request, then reads the set's content with the returned bookId —
// so no route re-implements (or forgets) a condition.
//
//   owner     the set's doctor, while their doctor profile is approved and
//             their account isn't suspended — any set status (preview).
//   admin     an admin, any status (moderation).
//   entitled  an ACTIVE entitlement AND the set is published AND inside its
//             start/end window (database clock) AND its doctor is approved
//             and not suspended.
//
// Anything else is null, and callers answer "not found" — never whether the
// set exists or why access was refused.
import { and, eq, sql } from "drizzle-orm";
import {
  doctorProfiles,
  questionSetEntitlements,
  questionSets,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

export type QuestionSetViewer = { id: string; role?: string | null };

export type QuestionSetAccess = {
  role: "owner" | "entitled" | "admin";
  setId: string;
  bookId: string;
  entitlementId: string | null;
};

export type QuestionSetAccessRow = {
  setId: string;
  bookId: string;
  ownerId: string;
  status: "draft" | "published" | "disabled" | "archived";
  windowOpen: boolean;
  doctorActive: boolean;
  entitlementId: string | null;
};

// Pure decision (unit-tested).
export function decideQuestionSetAccess(
  viewer: QuestionSetViewer,
  row: QuestionSetAccessRow | undefined | null
): QuestionSetAccess | null {
  if (!row) return null;
  const base = { setId: row.setId, bookId: row.bookId };
  if (viewer.role === "admin") {
    return { ...base, role: "admin", entitlementId: null };
  }
  if (row.ownerId === viewer.id) {
    return row.doctorActive
      ? { ...base, role: "owner", entitlementId: null }
      : null;
  }
  if (
    row.entitlementId &&
    row.status === "published" &&
    row.windowOpen &&
    row.doctorActive
  ) {
    return { ...base, role: "entitled", entitlementId: row.entitlementId };
  }
  return null;
}

// The SQL fragments shared by every access-aware query: the window and the
// doctor's standing, both evaluated by Postgres (now()), never the client.
export const questionSetWindowOpen = sql<boolean>`(
  (${questionSets.startsAt} is null or ${questionSets.startsAt} <= now())
  and (${questionSets.endsAt} is null or ${questionSets.endsAt} > now())
)`;

export const questionSetDoctorActive = sql<boolean>`(
  ${doctorProfiles.status} = 'approved' and ${users.suspendedAt} is null
)`;

// A protected set's question images are addressed by set + image id, never
// by storage key, and served only through
// app/api/question-sets/[setId]/images/[imageId] (access-checked, streamed,
// no-store).
export function questionSetImageUrl(setId: string, imageId: string): string {
  return `/api/question-sets/${setId}/images/${imageId}`;
}

export async function getQuestionSetAccess(
  viewer: QuestionSetViewer,
  setId: string
): Promise<QuestionSetAccess | null> {
  const db = getDb();
  if (!db) return null;
  if (!/^[0-9a-f-]{36}$/i.test(setId)) return null;
  const [row] = await db
    .select({
      setId: questionSets.id,
      bookId: questionSets.bookId,
      ownerId: questionSets.ownerId,
      status: questionSets.status,
      windowOpen: questionSetWindowOpen,
      doctorActive: sql<boolean>`coalesce(${questionSetDoctorActive}, false)`,
      entitlementId: questionSetEntitlements.id,
    })
    .from(questionSets)
    .innerJoin(users, eq(users.id, questionSets.ownerId))
    .leftJoin(doctorProfiles, eq(doctorProfiles.userId, questionSets.ownerId))
    .leftJoin(
      questionSetEntitlements,
      and(
        eq(questionSetEntitlements.setId, questionSets.id),
        eq(questionSetEntitlements.userId, viewer.id),
        eq(questionSetEntitlements.status, "active")
      )
    )
    .where(eq(questionSets.id, setId))
    .limit(1);
  return decideQuestionSetAccess(viewer, row);
}
