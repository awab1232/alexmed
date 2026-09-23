"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export type AiRequest = { question: string; id: number };

// Bottom sheet onto the existing chapter-scoped RAG chat (lib/trpc/
// chatRouter.ts) — the same session the chapter page's "اسألني" tab uses,
// so nothing new server-side: answers stay grounded in this chapter's pages.
// `request` lets a study mode open the sheet with a question already sent
// (e.g. the quiz's "اطلب من الذكاء الاصطناعي" field); its `id` changes per
// request so asking the same text twice still sends twice.
export default function StudyAiSheet({
  chapterId,
  open,
  onClose,
  request,
}: {
  chapterId: string;
  open: boolean;
  onClose: () => void;
  request?: AiRequest | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const sentRequestIdRef = useRef<number | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const getOrCreateSession = trpc.chat.getOrCreateSession.useMutation({
    onSuccess: session => setSessionId(session.id),
  });
  const messagesQuery = trpc.chat.listMessages.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: !!sessionId }
  );
  const ask = trpc.chat.ask.useMutation({
    onSuccess: () => {
      setInput("");
      messagesQuery.refetch();
    },
  });

  useEffect(() => {
    if (!open || sessionId || getOrCreateSession.isPending) return;
    getOrCreateSession.mutate({ scope: "chapter", chapterId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, chapterId, sessionId]);

  useEffect(() => {
    if (!open || !sessionId || !request) return;
    if (sentRequestIdRef.current === request.id) return;
    sentRequestIdRef.current = request.id;
    ask.mutate({ sessionId, question: request.question });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId, request]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messagesQuery.data?.length, ask.isPending, open]);

  if (!open) return null;

  function send() {
    const question = input.trim();
    if (!question || !sessionId || ask.isPending) return;
    ask.mutate({ sessionId, question });
  }

  return (
    <div className="study-sheet-backdrop" onClick={onClose}>
      <div
        className="study-sheet study-ai-sheet"
        onClick={event => event.stopPropagation()}
      >
        <div className="study-sheet-head">
          <strong>المساعد الذكي</strong>
          <button type="button" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="study-ai-messages">
          {!sessionId && (
            <div className="study-ai-status">
              <Loader2 size={16} className="spin" /> جاري التحضير...
            </div>
          )}
          {sessionId && !messagesQuery.data?.length && !ask.isPending && (
            <p className="study-ai-empty">
              اسأل أي شيء عن هذا الفصل، والإجابة من صفحاته نفسها.
            </p>
          )}
          {messagesQuery.data?.map(message => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "study-ai-message is-user"
                  : "study-ai-message"
              }
            >
              {message.content}
              {!!message.citedPages?.length && (
                <small>المصدر: صفحة {message.citedPages.join("، ")}</small>
              )}
            </div>
          ))}
          {ask.isPending && (
            <div className="study-ai-status">
              <Loader2 size={16} className="spin" /> يكتب...
            </div>
          )}
          {ask.error && (
            <p className="study-ai-error">
              {ask.error.message || "تعذر الوصول للمساعد. حاول مرة أخرى."}
            </p>
          )}
          <div ref={listEndRef} />
        </div>
        <form
          className="study-ai-form"
          onSubmit={event => {
            event.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="اكتب سؤالك..."
          />
          <button
            type="submit"
            disabled={!input.trim() || !sessionId || ask.isPending}
            aria-label="إرسال"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
