// "اسأل AI" on text the student selects in the PDF reader
// (components/pdf/SelectionAssistant.tsx → books.askAboutSelection).
// Pure prompt building + a small per-user rate limit; the model is the fast
// text model (FAST_TEXT_MODEL, e.g. grok-cli/grok-4.6) since this is a
// short, interactive, text-only answer.
import type { Message } from "./llm";

export type SelectionAction =
  | "explain"
  | "arabic"
  | "exam"
  | "summarize"
  | "ask";

export type SelectionTurn = { role: "user" | "assistant"; content: string };

const ACTION_PROMPTS: Record<Exclude<SelectionAction, "ask">, string> = {
  explain:
    "Explain the selected text simply and clearly, as a tutor would, then give the key point to remember.",
  arabic:
    "Explain the selected text in clear Arabic (Modern Standard), keeping every English medical/technical term in English next to its Arabic meaning.",
  exam: "Write 2 exam-style questions on the selected text (one MCQ with 4 options, one short-answer), then give the answers with a one-line explanation each.",
  summarize:
    "Summarize the selected text in 3-5 short bullet points a student can memorize.",
};

export function buildSelectionAssistantMessages(input: {
  fileName: string;
  pageNumber: number;
  pageText: string;
  selectedText: string;
  action: SelectionAction;
  question?: string;
  history?: SelectionTurn[];
}): Message[] {
  const task =
    input.action === "ask"
      ? `Answer the student's question about the selected text: ${input.question?.trim() || "Explain it."}`
      : ACTION_PROMPTS[input.action];
  return [
    {
      role: "system",
      content: [
        "You are a patient study tutor inside a PDF reader. The student selected a passage and wants help with it.",
        "Ground your answer in the selected text and the rest of its page (given below). You may add brief, well-established background knowledge to make it understandable, but never contradict or invent facts about the source; if the source is unclear or seems wrong, say so.",
        "Reply in the student's language: Arabic by default (the students are Arabic speakers), keeping English terminology in English. Use short paragraphs or bullets. Be concise — this is a quick in-reader answer, not an essay.",
        "Plain text only (no JSON, no tables).",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `File: ${input.fileName} — page ${input.pageNumber}`,
        `Full page text (context):\n${input.pageText || "(no extracted text for this page)"}`,
        `Selected text:\n"""${input.selectedText}"""`,
      ].join("\n\n"),
    },
    {
      role: "assistant",
      content: "I've read the page and the selected passage.",
    },
    ...(input.history ?? []),
    { role: "user", content: task },
  ];
}

// Simple in-memory sliding window per user (single app instance on
// Railway). Every call is a real LLM request, so a student can't hammer it.
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 40;
const recent = new Map<string, number[]>();

export function allowSelectionAssistantRequest(
  userId: string,
  now = Date.now()
): boolean {
  const kept = (recent.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  if (kept.length >= MAX_REQUESTS_PER_WINDOW) {
    recent.set(userId, kept);
    return false;
  }
  kept.push(now);
  recent.set(userId, kept);
  return true;
}
