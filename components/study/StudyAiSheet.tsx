"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Square, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import RichText from "@/components/assistant/RichText";
import NiroAvatar from "@/components/niro/NiroAvatar";
import NiroThinking from "@/components/niro/NiroThinking";
import { NIRO_NAME } from "@/lib/niro";

export type AiRequest = { question: string; id: number };

// Which study-chat scope the assistant grounds in — one chapter, or the
// whole book (the book-wide study page, so answers can use any page).
export type AiTarget =
  | { scope: "chapter"; chapterId: string }
  | { scope: "book"; bookId: string };

type Turn = {
  key: string;
  role: "user" | "assistant";
  content: string;
  pages?: number[];
};

const SUGGESTIONS = [
  "لخّص لي أهم النقاط 📌",
  "اختبرني بسؤال 📝",
  "اشرح أصعب فكرة ببساطة 🧠",
];

function pageNumbers(
  cited: { bookId: string; pageNumber: number }[] | null | undefined
): number[] {
  return [...new Set((cited ?? []).map(page => page.pageNumber))].sort(
    (a, b) => a - b
  );
}

// Bottom sheet onto the study chat (lib/study-chat.ts): grounded in this
// chapter/book's own pages when they're relevant, and happy to help with
// anything beyond them too. Answers stream from /api/chat/stream and are
// saved to the student's own session (the same one the chapter page's
// "اسألني" tab uses), so reopening shows the conversation. `request` lets a
// study mode open the sheet with a question already sent (e.g. the quiz's
// "اطلب من الذكاء الاصطناعي" field); its `id` changes per request so asking
// the same text twice still sends twice.
export default function StudyAiSheet({
  target,
  open,
  onClose,
  request,
}: {
  target: AiTarget;
  open: boolean;
  onClose: () => void;
  request?: AiRequest | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  // Turns of the exchange in progress (until the saved copy is reloaded).
  const [live, setLive] = useState<Turn[]>([]);
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming">(
    "idle"
  );
  const [error, setError] = useState("");
  const sentRequestIdRef = useRef<number | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";

  const getOrCreateSession = trpc.chat.getOrCreateSession.useMutation({
    onSuccess: session => setSessionId(session.id),
  });
  const messagesQuery = trpc.chat.listMessages.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: !!sessionId }
  );

  useEffect(() => {
    if (!open || sessionId || getOrCreateSession.isPending) return;
    getOrCreateSession.mutate(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  useEffect(() => {
    if (!open || !sessionId || !request) return;
    if (sentRequestIdRef.current === request.id) return;
    sentRequestIdRef.current = request.id;
    void ask(request.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId, request]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messagesQuery.data?.length, live, status, open]);

  // Stop any answer still streaming when the sheet goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || !sessionId || busy) return;
    const stamp = Date.now();
    setLive([{ key: `u${stamp}`, role: "user", content: question }]);
    setInput("");
    setError("");
    setStatus("waiting");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "تعذر الوصول للمساعد. حاول مرة أخرى 🙏");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setStatus("streaming");
        const textSoFar = answer;
        setLive(current => [
          current[0],
          { key: `a${stamp}`, role: "assistant", content: textSoFar },
        ]);
      }
      // The server saved both turns — show the saved copies (with sources).
      await messagesQuery.refetch();
      setLive([]);
    } catch (err) {
      // Stopped by the student: keep what was already written on screen
      // (the server still finishes and saves the full answer).
      if (controller.signal.aborted) return;
      setLive([]);
      setInput(question);
      setError(
        err instanceof Error
          ? err.message
          : "تعذر الوصول للمساعد. حاول مرة أخرى 🙏"
      );
      messagesQuery.refetch();
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStatus("idle");
    }
  }

  if (!open) return null;

  const saved: Turn[] = (messagesQuery.data ?? []).map(message => ({
    key: message.id,
    role: message.role,
    content: message.content,
    pages: message.role === "assistant" ? pageNumbers(message.citedPages) : [],
  }));
  // While an exchange is live its question may already be in the saved
  // list (after a refetch) — don't show it twice.
  const liveKeys = new Set(
    live.map(turn => `${turn.role}:${turn.content.trim()}`)
  );
  const turns = [
    ...(live.length
      ? saved.filter(
          (turn, index) =>
            index < saved.length - 2 ||
            !liveKeys.has(`${turn.role}:${turn.content.trim()}`)
        )
      : saved),
    ...live,
  ];
  const scopeLabel = target.scope === "chapter" ? "هذا الجزء" : "هذا الملف";

  return (
    <div className="study-sheet-backdrop" onClick={onClose}>
      <div
        className="study-sheet study-ai-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`اسأل ${NIRO_NAME}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="study-sheet-head">
          <strong className="niro-identity">
            <NiroAvatar size={26} expression="explaining" spark="glow" />
            اسأل {NIRO_NAME}
          </strong>
          <button type="button" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="study-ai-messages" aria-live="polite">
          {!sessionId && !getOrCreateSession.isError && (
            <div className="study-ai-status">
              <Loader2 size={16} className="spin" /> جاري التحضير...
            </div>
          )}
          {getOrCreateSession.isError && (
            <p className="study-ai-error">تعذر فتح المساعد لهذا الملف.</p>
          )}
          {sessionId && !turns.length && !busy && (
            <div className="study-ai-empty">
              <p>
                أهلاً، أنا {NIRO_NAME} 👋 اسألني أي شيء عن {scopeLabel} أو حتى
                خارجه — شرح، تلخيص، أسئلة، مقارنة… وأنا معك 😌
              </p>
              <div className="selection-ai-actions">
                {SUGGESTIONS.map(suggestion => (
                  <button
                    type="button"
                    key={suggestion}
                    className="quiz-pill"
                    onClick={() => ask(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map(turn =>
            turn.role === "user" ? (
              <div
                key={turn.key}
                dir="auto"
                className="study-ai-message is-user"
              >
                {turn.content}
              </div>
            ) : !turn.content ? null : (
              <div key={turn.key} className="study-ai-message">
                <RichText text={turn.content} />
                {!!turn.pages?.length && (
                  <small>📄 من الملف: صفحة {turn.pages.join("، ")}</small>
                )}
              </div>
            )
          )}
          {status === "waiting" && <NiroThinking />}
          {error && <p className="study-ai-error">{error}</p>}
          <div ref={listEndRef} />
        </div>
        <form
          className="study-ai-form"
          onSubmit={event => {
            event.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            dir="auto"
            onChange={event => setInput(event.target.value)}
            placeholder="اكتب سؤالك..."
            aria-label="سؤالك"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="إيقاف"
            >
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !sessionId}
              aria-label="إرسال"
            >
              <Send size={18} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
