// Request-scoped context for AI calls, so the provider's per-call log line
// (lib/ai/providers/omniroute.ts) can say which job / user / operation a
// call belonged to without threading ids through every generator's
// signature. Workers wrap their work in withAiContext(); anything outside
// one simply logs without those fields.
import { AsyncLocalStorage } from "node:async_hooks";

export type AiCallContext = {
  operation?: string;
  jobId?: string;
  userId?: string;
  bookId?: string;
  chapterId?: string;
};

const storage = new AsyncLocalStorage<AiCallContext>();

export function withAiContext<T>(
  context: AiCallContext,
  run: () => Promise<T>
): Promise<T> {
  return storage.run({ ...storage.getStore(), ...context }, run);
}

export function currentAiContext(): AiCallContext {
  return storage.getStore() ?? {};
}

// One JSON line per event — ids, model, timings and error class only.
// Never prompts, page text, answers or keys.
export function logAiEvent(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined>
) {
  const line = JSON.stringify({
    evt: event,
    at: new Date().toISOString(),
    ...currentAiContext(),
    ...fields,
  });
  if (fields.status === "error") console.warn(line);
  else console.info(line);
}
