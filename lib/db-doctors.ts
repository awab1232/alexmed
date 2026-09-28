// Doctor capability (Protected Doctor Question Sets). A doctor is a normal
// NiroLearn account with an approved doctor_profiles row — users.role is
// never touched. Status transitions are single conditional UPDATEs, so two
// admins acting at once can't both "win" an incompatible change.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { doctorProfiles, users } from "../drizzle/schema";
import { getDb, requireDb } from "./db";
import { recordQuestionSetEvent } from "./db-question-set-audit";

export type DoctorStatus = "pending" | "approved" | "rejected" | "suspended";

export type DoctorApplicationInput = {
  fullName: string;
  university: string;
  faculty: string;
  department: string;
  universityEmail?: string | null;
  note?: string | null;
};

const ownProfileColumns = {
  status: doctorProfiles.status,
  fullName: doctorProfiles.fullName,
  university: doctorProfiles.university,
  faculty: doctorProfiles.faculty,
  department: doctorProfiles.department,
  universityEmail: doctorProfiles.universityEmail,
  note: doctorProfiles.note,
  rejectionReason: doctorProfiles.rejectionReason,
  createdAt: doctorProfiles.createdAt,
  reviewedAt: doctorProfiles.reviewedAt,
};

export async function getDoctorProfile(userId: string) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select(ownProfileColumns)
    .from(doctorProfiles)
    .where(eq(doctorProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}

// The check behind doctorProcedure — read from the database on every call
// (never from the session), joined with the account's own suspension.
export async function isApprovedDoctor(userId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ userId: doctorProfiles.userId })
    .from(doctorProfiles)
    .innerJoin(users, eq(users.id, doctorProfiles.userId))
    .where(
      and(
        eq(doctorProfiles.userId, userId),
        eq(doctorProfiles.status, "approved"),
        isNull(users.suspendedAt)
      )
    )
    .limit(1);
  return !!row;
}

// A first application, or a new one after a rejection. A pending, approved
// or suspended profile can't be overwritten by re-applying.
export async function applyForDoctor(
  userId: string,
  input: DoctorApplicationInput
): Promise<boolean> {
  const db = requireDb();
  const values = {
    fullName: input.fullName,
    university: input.university,
    faculty: input.faculty,
    department: input.department,
    universityEmail: input.universityEmail || null,
    note: input.note || null,
  };
  const rows = await db
    .insert(doctorProfiles)
    .values({ userId, status: "pending", ...values })
    .onConflictDoUpdate({
      target: doctorProfiles.userId,
      set: {
        ...values,
        status: "pending",
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
        updatedAt: new Date(),
      },
      setWhere: eq(doctorProfiles.status, "rejected"),
    })
    .returning({ userId: doctorProfiles.userId });
  return rows.length > 0;
}

// ── Admin review ─────────────────────────────────────────────────────────

export type DoctorReviewAction = "approve" | "reject" | "suspend" | "reinstate";

const TRANSITIONS: Record<
  DoctorReviewAction,
  { from: DoctorStatus; to: DoctorStatus; event: string }
> = {
  approve: { from: "pending", to: "approved", event: "doctor_approved" },
  reject: { from: "pending", to: "rejected", event: "doctor_rejected" },
  suspend: { from: "approved", to: "suspended", event: "doctor_suspended" },
  reinstate: { from: "suspended", to: "approved", event: "doctor_reinstated" },
};

export async function reviewDoctor(
  adminId: string,
  userId: string,
  action: DoctorReviewAction,
  reason?: string | null
): Promise<boolean> {
  const db = requireDb();
  const { from, to, event } = TRANSITIONS[action];
  const now = new Date();
  const rows = await db
    .update(doctorProfiles)
    .set({
      status: to,
      reviewedById: adminId,
      reviewedAt: now,
      updatedAt: now,
      ...(action === "reject" ? { rejectionReason: reason || null } : {}),
      ...(action === "suspend" ? { suspendedAt: now } : {}),
      ...(action === "reinstate" ? { suspendedAt: null } : {}),
    })
    .where(
      and(eq(doctorProfiles.userId, userId), eq(doctorProfiles.status, from))
    )
    .returning({ userId: doctorProfiles.userId });
  if (!rows.length) return false;
  await recordQuestionSetEvent(db, {
    actorId: adminId,
    event,
    targetId: userId,
  });
  return true;
}

export async function listDoctorsForAdmin(status?: DoctorStatus) {
  const db = getDb();
  if (!db) return [];
  return db
    .select({
      userId: doctorProfiles.userId,
      status: doctorProfiles.status,
      fullName: doctorProfiles.fullName,
      university: doctorProfiles.university,
      faculty: doctorProfiles.faculty,
      department: doctorProfiles.department,
      universityEmail: doctorProfiles.universityEmail,
      note: doctorProfiles.note,
      rejectionReason: doctorProfiles.rejectionReason,
      createdAt: doctorProfiles.createdAt,
      reviewedAt: doctorProfiles.reviewedAt,
      accountName: users.name,
      accountEmail: users.email,
      accountUsername: users.username,
      setCount: sql<number>`(select count(*)::int from question_sets qs where qs."ownerId" = ${doctorProfiles.userId})`,
    })
    .from(doctorProfiles)
    .innerJoin(users, eq(users.id, doctorProfiles.userId))
    .where(status ? eq(doctorProfiles.status, status) : undefined)
    .orderBy(desc(doctorProfiles.createdAt))
    .limit(200);
}
