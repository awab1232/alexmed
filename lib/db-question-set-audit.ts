// question_set_audit_events writer — ids, event names and small counts only.
// Never a plaintext access code, a raw IP or question content.
import { questionSetAuditEvents } from "../drizzle/schema";
import type { requireDb } from "./db";

type Executor = Pick<ReturnType<typeof requireDb>, "insert">;

export type QuestionSetEvent = {
  setId?: string | null;
  actorId?: string | null;
  event: string;
  targetId?: string | null;
  meta?: Record<string, string | number | boolean>;
};

export async function recordQuestionSetEvent(
  executor: Executor,
  event: QuestionSetEvent
): Promise<void> {
  await executor.insert(questionSetAuditEvents).values({
    setId: event.setId ?? null,
    actorId: event.actorId ?? null,
    event: event.event,
    targetId: event.targetId ?? null,
    meta: event.meta ?? null,
  });
}
