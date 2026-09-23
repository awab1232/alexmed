// Per-user rate limit on JOB CREATION specifically (not on every request) —
// DB-backed rather than a new Redis/Upstash-ratelimit dependency, since the
// check is infrequent (once per upload) and Postgres already has the rows
// needed to count from.
import { and, count, eq, gte } from "drizzle-orm";
import {
  adminMaterials,
  books,
  chatMessages,
  chatSessions,
  mirrorJobs,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  getChatRateLimitMax,
  getChatRateLimitWindowMinutes,
  getJobCreationRateLimitMax,
  getJobCreationRateLimitWindowMinutes,
} from "./types";

export class RateLimitedError extends Error {
  constructor(
    message = "لقد تجاوزت الحد المسموح لإنشاء الملفات، حاول لاحقًا."
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

export async function assertJobCreationAllowed(
  userId: string,
  kind: "mirror" | "books" | "admin_materials"
): Promise<void> {
  const db = getDb();
  if (!db) return; // no DB configured (local tooling) — nothing to enforce

  const windowStart = new Date(
    Date.now() - getJobCreationRateLimitWindowMinutes() * 60_000
  );

  // adminMaterials' owner column is named ownerAdminId (not userId, unlike
  // mirrorJobs/books) — handled as its own branch rather than forcing a
  // shared column name across an unrelated, deliberately isolated table.
  if (kind === "admin_materials") {
    const [row] = await db
      .select({ c: count() })
      .from(adminMaterials)
      .where(
        and(
          eq(adminMaterials.ownerAdminId, userId),
          gte(adminMaterials.createdAt, windowStart)
        )
      );
    if (Number(row?.c ?? 0) >= getJobCreationRateLimitMax()) {
      throw new RateLimitedError();
    }
    return;
  }

  const table = kind === "mirror" ? mirrorJobs : books;
  const [row] = await db
    .select({ c: count() })
    .from(table)
    .where(and(eq(table.userId, userId), gte(table.createdAt, windowStart)));

  if (Number(row?.c ?? 0) >= getJobCreationRateLimitMax()) {
    throw new RateLimitedError();
  }
}

export class ChatRateLimitedError extends Error {
  constructor(message = "أسئلة كثيرة خلال وقت قصير، حاول بعد شوي.") {
    super(message);
    this.name = "ChatRateLimitedError";
  }
}

// Per-user rate limit on اسألني (chatRouter.ask) — each call is a real LLM
// spend, unlike مِرآة/كتبي uploads above this had no limit at all.
// chatMessages carries no userId of its own (only sessionId), so this counts
// through a join to chatSessions.userId instead of the single-table filter
// assertJobCreationAllowed uses.
export async function assertChatMessageAllowed(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const windowStart = new Date(
    Date.now() - getChatRateLimitWindowMinutes() * 60_000
  );
  const [row] = await db
    .select({ c: count() })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.sessionId))
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatMessages.role, "user"),
        gte(chatMessages.createdAt, windowStart)
      )
    );

  if (Number(row?.c ?? 0) >= getChatRateLimitMax()) {
    throw new ChatRateLimitedError();
  }
}
