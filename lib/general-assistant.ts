// The general مساعد AI (bottom nav) — an open, ChatGPT-style assistant for
// ANY question (not only the student's own files; that's what the PDF
// reader's "اسأل AI" is for), including photos the student uploads (a
// question from a paper, a diagram, handwritten notes, an X-ray…). Pure
// prompt building + image validation, used by
// app/api/assistant/chat/route.ts.
import type { Message, MessageContent } from "./llm";
import { NIRO_PERSONA_PROMPT } from "./niro";

export type AssistantTurn = {
  role: "user" | "assistant";
  content: string;
  // data:image/...;base64 — only ever on user turns.
  image?: string;
};

// How much conversation is sent back each turn — enough to follow the
// thread, bounded so a long chat stays fast and cheap.
export const MAX_HISTORY_TURNS = 16;
// Images per request (the new one + the latest earlier one, so follow-ups
// like "and question 2 in the photo?" still see it).
export const MAX_IMAGES_PER_REQUEST = 2;
// ~4 MB of base64 — the client already downsizes photos to ~1600px JPEG,
// which is typically 150–600 KB.
export const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

const IMAGE_DATA_URL =
  /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

export function isValidImageDataUrl(value: string): boolean {
  return (
    value.length <= MAX_IMAGE_DATA_URL_LENGTH && IMAGE_DATA_URL.test(value)
  );
}

// When the student sends only a photo with no text.
export const DEFAULT_IMAGE_PROMPT = "حلّل هذه الصورة وساعدني فيها.";

function userContent(text: string, image?: string): Message["content"] {
  if (!image) return text;
  const parts: MessageContent[] = [
    { type: "text", text: text || DEFAULT_IMAGE_PROMPT },
    { type: "image_url", image_url: { url: image, detail: "high" } },
  ];
  return parts;
}

export function buildGeneralAssistantMessages(input: {
  studentName?: string;
  history: AssistantTurn[];
  message: string;
  image?: string;
}): Message[] {
  const name = input.studentName?.trim();
  const history = input.history.slice(-MAX_HISTORY_TURNS);
  // Only the most recent earlier image is re-sent (cost/latency bound);
  // older photos become a short text marker so the thread still reads right.
  let keptImage = input.image
    ? MAX_IMAGES_PER_REQUEST - 1
    : MAX_IMAGES_PER_REQUEST;
  const turns: Message[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role === "user" && turn.image && keptImage > 0) {
      keptImage--;
      turns.unshift({
        role: "user",
        content: userContent(turn.content, turn.image),
      });
    } else {
      turns.unshift({
        role: turn.role,
        content:
          turn.role === "user" && turn.image
            ? `[أرسلت صورة سابقًا] ${turn.content}`.trim()
            : turn.content,
      });
    }
  }
  return [
    {
      role: "system",
      content: [
        NIRO_PERSONA_PROMPT,
        `You are chatting in the app's main assistant with a university student (many study medicine).${name ? ` The student's name is ${name}.` : ""}`,
        "You are an open, general-purpose assistant like ChatGPT: help with ANYTHING the student asks — any subject or field (medicine, science, math, languages, programming…), explaining concepts in depth, solving and checking problems step by step, writing and editing, translation, study plans and time management, exam strategy, memorization tricks, motivation, general knowledge and everyday questions. Never refuse just because a question is outside studying.",
        "Images: when the student sends a photo, look at it carefully first. Read any text in it (Arabic or English, printed or handwritten), then do what they ask — or, if they didn't say, identify what it is and help: solve the questions in it step by step with the final answer clearly marked, explain diagrams/charts/tables/slides, transcribe or summarise notes. For medical images (X-ray, ECG, histology, clinical photos) explain the findings educationally. If part of the image is unreadable, say which part instead of guessing.",
        "Quality: be accurate and thorough enough to really help, but get to the point. For problems show the reasoning then the final answer. For MCQs give the correct option and why the others are wrong. If you're not sure, say so honestly instead of inventing. For personal medical symptoms or emergencies, give general educational info and advise seeing a doctor.",
        "Personality: friendly, encouraging and positive — celebrate effort, reassure when they're stressed, and gently push them to keep going. Use fitting emojis in most replies (usually 1-4, e.g. 📚✨💪🧠🎯😊) without overdoing it.",
        "Language: reply in the student's language — Arabic by default (natural, simple Modern Standard; a light Levantine tone is fine), keeping English scientific/medical terms in English next to their meaning.",
        "Formatting: use Markdown — short paragraphs, **bold** for key terms, bullet or numbered lists for steps, ### headings for longer answers, tables when comparing things, and ``` code blocks for code. Write math and formulas in plain text with Unicode symbols (×, ÷, ≈, √, ², →, e.g. CO = HR × SV) — never LaTeX (no \\[ \\], \\frac, \\text). End longer answers with a short encouraging line or a quick question to check understanding.",
      ].join("\n"),
    },
    ...turns,
    { role: "user", content: userContent(input.message, input.image) },
  ];
}
