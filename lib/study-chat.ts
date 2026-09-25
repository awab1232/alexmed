// One study-chat turn (the study sheets' "المساعد الذكي" and the chapter
// page's "اسألني"): retrieve the scope's overview + most relevant pages,
// then build the prompt with recent history. Shared by chat.ask (tRPC,
// whole answer) and /api/chat/stream (streamed) so both behave the same.
import type { ChatSession } from "../drizzle/schema";
import { listChatMessages } from "./db-chat";
import { FAST_TEXT_MODEL, invokeLLM, type Message } from "./llm";
import {
  buildRagSystemPrompt,
  buildStudyContext,
  getPageChunk,
  getScopeOverview,
  searchBookPages,
  searchChapterPages,
  searchSubjectPages,
  type RetrievedChunk,
} from "./rag";

// Bounded conversation memory — enough to follow a "اختبرني" back-and-forth
// without an unbounded (and increasingly expensive) prompt.
export const HISTORY_MESSAGE_LIMIT = 12;

function search(session: ChatSession, query: string) {
  switch (session.scope) {
    case "page":
      return getPageChunk(session.pageId!);
    case "chapter":
      return searchChapterPages(session.chapterId!, query);
    case "book":
      return searchBookPages(session.bookId!, query);
    default:
      return searchSubjectPages(session.subjectId!, query);
  }
}

const ARABIC = /\p{Script=Arabic}/u;
const EXPANSION_TIMEOUT_MS = 8000;

// Students ask in Arabic about (mostly) English textbooks, and keyword
// search can't bridge languages ("قانون فرانك ستارلنج" never matches
// "Frank-Starling law"). When an Arabic question finds no page, ask the
// fast model for English search terms and search again. Best-effort: any
// failure or a slow model just means no extra terms.
export async function englishSearchTerms(question: string): Promise<string> {
  const call = invokeLLM({
    model: FAST_TEXT_MODEL || undefined,
    max_tokens: 60,
    messages: [
      {
        role: "system",
        content:
          "Turn the student's question into English search keywords for finding the relevant pages in an English textbook. Reply with 3-8 English keywords or short terms separated by spaces and nothing else. Use the standard English scientific/medical term for every Arabic term.",
      },
      { role: "user", content: question },
    ],
  }).then(response => response.choices[0]?.message.content ?? "");
  const timeout = new Promise<string>(resolve =>
    setTimeout(() => resolve(""), EXPANSION_TIMEOUT_MS)
  );
  try {
    const terms = await Promise.race([call, timeout]);
    return terms.replace(/[^\p{L}\p{N}\s-]/gu, " ").slice(0, 200).trim();
  } catch {
    return "";
  }
}

async function retrieve(session: ChatSession, question: string) {
  const chunks = await search(session, question);
  if (chunks.length || session.scope === "page" || !ARABIC.test(question)) {
    return chunks;
  }
  const terms = await englishSearchTerms(question);
  return terms ? search(session, terms) : chunks;
}

// Call AFTER appending the student's question to the session: that last
// message is replaced by the full context-bearing version.
export async function prepareStudyChatTurn(
  userId: string,
  session: ChatSession,
  question: string
): Promise<{ messages: Message[]; chunks: RetrievedChunk[] }> {
  const [chunks, overview, history] = await Promise.all([
    retrieve(session, question),
    getScopeOverview(session),
    listChatMessages(userId, session.id),
  ]);
  const recentHistory = history
    .slice(0, -1) // the question itself is re-sent below with its context
    .slice(-HISTORY_MESSAGE_LIMIT)
    .filter(message => message.content.trim())
    .map(
      message =>
        ({ role: message.role, content: message.content }) as Message
    );
  return {
    chunks,
    messages: [
      { role: "system", content: buildRagSystemPrompt(session.scope) },
      ...recentHistory,
      { role: "user", content: buildStudyContext(overview, chunks, question) },
    ],
  };
}

export function citedPagesOf(chunks: RetrievedChunk[]) {
  return chunks.map(chunk => ({
    bookId: chunk.bookId,
    pageNumber: chunk.pageNumber,
  }));
}
