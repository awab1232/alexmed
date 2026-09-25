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

// {subject} = "the selected text", or "this page" when the student opened the
// assistant from the toolbar without selecting anything.
const ACTION_PROMPTS: Record<Exclude<SelectionAction, "ask">, string> = {
  explain:
    "Explain {subject} simply and clearly, as a tutor would, then give the key point(s) to remember.",
  arabic:
    "Explain {subject} in clear Arabic (Modern Standard), keeping every English medical/technical term in English next to its Arabic meaning.",
  exam: "Write 2 exam-style questions on {subject} (one MCQ with 4 options, one short-answer), then give the answers with a one-line explanation each.",
  summarize:
    "Summarize {subject} in 3-5 short bullet points a student can memorize.",
};

export function buildSelectionAssistantMessages(input: {
  fileName: string;
  pageNumber: number;
  pageText: string;
  // Empty = the whole page is the subject (toolbar "اسأل AI" with no
  // selection).
  selectedText: string;
  action: SelectionAction;
  question?: string;
  history?: SelectionTurn[];
}): Message[] {
  const hasSelection = input.selectedText.trim().length > 0;
  const subject = hasSelection ? "the selected text" : "this page";
  const task =
    input.action === "ask"
      ? `Answer the student's question (usually about ${subject}, but it can be about anything): ${input.question?.trim() || "Explain it."}`
      : ACTION_PROMPTS[input.action].replace("{subject}", subject);
  return [
    {
      role: "system",
      content: [
        hasSelection
          ? `You are "مساعد NiroLearn", a brilliant, warm study tutor inside a PDF reader. The student selected a passage and wants help with it.`
          : `You are "مساعد NiroLearn", a brilliant, warm study tutor inside a PDF reader. The student is reading the page below and wants help with it.`,
        `Use ${hasSelection ? "the selected text and the rest of its page" : "this page"} (given below) as your main context, and bring in your own knowledge freely to explain it well — background, examples, mnemonics, clinical relevance, comparisons. Never misstate what the page says; if it seems unclear or wrong, say so.`,
        "Help with ANYTHING the student asks, even beyond this page or subject — never refuse because it isn't on the page. When an answer goes beyond the page, mark that part briefly (e.g. '📚 من خارج الصفحة:').",
        "Personality: friendly, encouraging and patient; a few fitting emojis (1-3) are welcome.",
        "Reply in the student's language: Arabic by default (the students are Arabic speakers), keeping English terminology in English next to its meaning.",
        "Formatting: Markdown — short paragraphs, **bold** key terms, bullet or numbered lists; math in plain text with Unicode symbols (×, ÷, ≈, √, ²), never LaTeX. Keep it focused (it's shown in a reader side-sheet) unless the student asks for more detail.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `File: ${input.fileName} — page ${input.pageNumber}`,
        `Full page text (context):\n${input.pageText || "(no extracted text for this page)"}`,
        ...(hasSelection
          ? [`Selected text:\n"""${input.selectedText}"""`]
          : []),
      ].join("\n\n"),
    },
    {
      role: "assistant",
      content: hasSelection
        ? "I've read the page and the selected passage."
        : "I've read the page.",
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
