"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";

export type PdfTextSelection = { text: string; pageNumber: number };

type Action = "explain" | "arabic" | "exam" | "summarize" | "ask";

type Turn = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS: { action: Exclude<Action, "ask">; label: string }[] = [
  { action: "explain", label: "اشرح ببساطة" },
  { action: "arabic", label: "اشرح بالعربي" },
  { action: "exam", label: "سؤال امتحان" },
  { action: "summarize", label: "لخّص" },
];

// Same actions, worded for the whole page (no selection).
const PAGE_ACTION_LABELS: Partial<Record<Action, string>> = {
  explain: "اشرح الصفحة",
  summarize: "لخّص الصفحة",
};

// "اسأل AI" for text the student selects in the PDF reader: a floating pill
// while a selection exists, then a bottom sheet with quick actions, a free
// question field, and follow-ups — answered by the fast text model
// (POST /api/books/ask-selection → FAST_TEXT_MODEL, streamed so text shows
// as it's written), grounded in the selection's page. Reuses the
// study-mode sheet styles (.study-sheet*, .study-ai-*).
export default function SelectionAssistant({
  bookId,
  fileName,
  selection,
  currentPage,
}: {
  bookId: string;
  fileName?: string;
  selection: PdfTextSelection | null;
  // Page the student is looking at — the subject when nothing is selected.
  currentPage: number;
}) {
  // The selection is copied when the sheet opens: tapping inside the sheet
  // clears the page selection, but the conversation stays about this text.
  const [active, setActive] = useState<PdfTextSelection | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const listEndRef = useRef<HTMLDivElement>(null);
  // "waiting" = sent, nothing streamed back yet; "streaming" = text arriving.
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming">(
    "idle"
  );
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [turns, status]);

  // Never leave a stream running after the sheet closes / unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Always available from the reader's toolbar: with a text selection it's
  // about that text, otherwise about the whole current page.
  function open() {
    setActive(selection ?? { text: "", pageNumber: currentPage });
    setTurns([]);
    setInput("");
    setError("");
  }

  function close() {
    abortRef.current?.abort();
    setStatus("idle");
    setActive(null);
    window.getSelection()?.removeAllRanges();
  }

  // Streams the answer from /api/books/ask-selection into the last turn as
  // it's written, so the student starts reading within seconds.
  async function send(action: Action, label: string, question?: string) {
    if (!active || busy) return;
    const history = turns;
    setTurns([...history, { role: "user", content: label }]);
    setInput("");
    setError("");
    setStatus("waiting");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/books/ask-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          pageNumber: active.pageNumber,
          selectedText: active.text.slice(0, 4000),
          action,
          question,
          fileName,
          // Server caps each turn at 6000 chars; a long answer is trimmed
          // rather than failing the follow-up with a 400.
          history: history
            .slice(-10)
            .map(turn => ({ ...turn, content: turn.content.slice(0, 6000) })),
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "تعذر الوصول للمساعد. حاول مرة أخرى.");
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
        const text = answer;
        setTurns(current => [
          ...current.slice(0, -1),
          { role: "assistant", content: text },
        ]);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      // Drop the unanswered prompt (and any empty answer bubble) so a retry
      // doesn't duplicate it in the history.
      setTurns(history);
      setError(
        err instanceof Error
          ? err.message
          : "تعذر الوصول للمساعد. حاول مرة أخرى."
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStatus("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        className={
          selection ? "pdf-viewer-ai-btn has-selection" : "pdf-viewer-ai-btn"
        }
        // Keep the text selected while tapping the button.
        onPointerDown={event => event.preventDefault()}
        onClick={open}
        aria-label={selection ? "اسأل AI عن النص المحدد" : "اسأل AI عن الصفحة"}
      >
        <Sparkles size={16} /> {selection ? "اسأل عن التحديد" : "اسأل AI"}
      </button>

      {active && (
        <div className="study-sheet-backdrop" onClick={close}>
          <div
            className="study-sheet study-ai-sheet"
            onClick={event => event.stopPropagation()}
          >
            <div className="study-sheet-head">
              <strong>
                <Sparkles size={16} /> المساعد · صفحة {active.pageNumber}
              </strong>
              <button type="button" onClick={close} aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>
            <div className="study-ai-messages">
              <blockquote className="selection-ai-quote" dir="auto">
                {!active.text
                  ? `الصفحة ${active.pageNumber} كاملة — حدّد نصاً قبل الضغط لتسأل عنه وحده.`
                  : active.text.length > 400
                    ? `${active.text.slice(0, 400)}…`
                    : active.text}
              </blockquote>
              {!turns.length && (
                <div className="selection-ai-actions">
                  {QUICK_ACTIONS.map(item => {
                    const label = active.text
                      ? item.label
                      : (PAGE_ACTION_LABELS[item.action] ?? item.label);
                    return (
                      <button
                        type="button"
                        key={item.action}
                        className="quiz-pill"
                        disabled={busy}
                        onClick={() => send(item.action, label)}
                      >
                        {label}
                      </button>
                    );
                  })}
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
                  <Loader2 size={16} className="spin" /> يكتب...
                </div>
              )}
              {error && <p className="study-ai-error">{error}</p>}
              <div ref={listEndRef} />
            </div>
            <form
              className="study-ai-form"
              onSubmit={event => {
                event.preventDefault();
                const question = input.trim();
                if (question) send("ask", question, question);
              }}
            >
              <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="اسأل عن هذا النص..."
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="إرسال"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
