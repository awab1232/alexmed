"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, RotateCcw, Send, Sparkles } from "lucide-react";

type Turn = { role: "user" | "assistant"; content: string };

// Shown as tappable chips on an empty chat — anything goes, these are just
// friendly starters.
const STARTERS = [
  "اشرح لي فكرة صعبة بطريقة بسيطة 🧠",
  "ساعدني أنظّم خطة دراسة لهذا الأسبوع 📅",
  "اختبرني بأسئلة سريعة في موضوع 📝",
  "عندي امتحان قريب وأنا متوتر 😟",
  "أعطني طريقة لحفظ معلومة بسهولة ✨",
  "أحتاج شوية تحفيز 💪",
];

const STORAGE_KEY = "mirror-assistant-chat-v1";
// Sent back as context each turn (server caps at 16 turns).
const HISTORY_TURNS = 16;

// The general مساعد AI: a friendly, encouraging study buddy for ANY question
// (POST /api/assistant/chat, streamed). Replaces the old folder/file-scoped
// RAG chat here — asking about a specific file now lives in the PDF reader's
// "اسأل AI" button. The conversation is kept in this browser (localStorage)
// so leaving and coming back doesn't lose it.
export default function AssistantPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0];
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming">(
    "idle"
  );
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";

  // Restore / persist the conversation (per browser; best-effort only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setTurns(saved.slice(-60));
    } catch {
      // Private mode / blocked storage — just start fresh.
    }
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-60)));
    } catch {
      // Ignore storage failures.
    }
  }, [turns, busy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = turns
      .filter(turn => turn.content)
      .slice(-HISTORY_TURNS)
      .map(turn => ({ ...turn, content: turn.content.slice(0, 8000) }));
    setTurns(current => [...current, { role: "user", content: message }]);
    setInput("");
    setError("");
    setStatus("waiting");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "تعذر الوصول للمساعد، حاول مرة أخرى 🙏");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      setTurns(current => [...current, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setStatus("streaming");
        const textSoFar = answer;
        setTurns(current => [
          ...current.slice(0, -1),
          { role: "assistant", content: textSoFar },
        ]);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      // Drop the unanswered question (and any empty bubble) so a retry
      // doesn't duplicate it.
      setTurns(current => {
        const trimmed = [...current];
        while (
          trimmed.length &&
          trimmed[trimmed.length - 1].role === "assistant" &&
          !trimmed[trimmed.length - 1].content
        ) {
          trimmed.pop();
        }
        if (trimmed[trimmed.length - 1]?.content === message) trimmed.pop();
        return trimmed;
      });
      setInput(message);
      setError(
        err instanceof Error
          ? err.message
          : "تعذر الوصول للمساعد، حاول مرة أخرى 🙏"
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStatus("idle");
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setTurns([]);
    setError("");
    setStatus("idle");
  }

  return (
    <section className="assistant-chat">
      <header className="assistant-chat-header">
        <div className="assistant-chat-avatar">
          <Sparkles size={22} />
        </div>
        <div className="assistant-chat-title">
          <strong>مساعدك الدراسي</strong>
          <small>اسألني أي شيء — أنا هنا لأساعدك 😊</small>
        </div>
        {!!turns.length && (
          <button
            type="button"
            className="assistant-chat-new"
            onClick={newChat}
            aria-label="محادثة جديدة"
          >
            <RotateCcw size={16} /> جديدة
          </button>
        )}
      </header>

      <div className="assistant-chat-messages">
        {!turns.length && (
          <div className="assistant-chat-welcome">
            <p className="assistant-chat-hello">
              أهلاً{firstName ? ` ${firstName}` : ""}! 👋✨
            </p>
            <p>
              أنا مساعدك الدراسي. اسألني عن أي شيء: شرح، أسئلة، خطة دراسة، أو
              حتى لو محتاج تشجيع 💪
            </p>
            <div className="assistant-chat-starters">
              {STARTERS.map(starter => (
                <button
                  type="button"
                  key={starter}
                  className="quiz-pill"
                  onClick={() => send(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, index) =>
          !turn.content ? null : (
            <div
              key={index}
              dir="auto"
              className={
                turn.role === "user"
                  ? "study-ai-message is-user"
                  : "study-ai-message"
              }
            >
              {turn.content}
            </div>
          )
        )}
        {status === "waiting" && (
          <div className="study-ai-status">
            <Loader2 size={16} className="spin" /> يفكّر... 🤔
          </div>
        )}
        {error && <p className="study-ai-error">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="study-ai-form assistant-chat-form"
        onSubmit={event => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder="اكتب سؤالك هنا..."
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          aria-label="إرسال"
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
