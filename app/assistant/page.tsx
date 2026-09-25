"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Check,
  Copy,
  Camera,
  ImagePlus,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import RichText from "@/components/assistant/RichText";

// `image` (full data URL) lives only in memory for follow-ups; `thumb` is a
// small copy kept with the saved conversation so old photos still show.
type Turn = {
  role: "user" | "assistant";
  content: string;
  image?: string;
  thumb?: string;
};

// Shown as tappable chips on an empty chat — anything goes, these are just
// friendly starters.
const STARTERS = [
  "اشرح لي فكرة صعبة بطريقة بسيطة 🧠",
  "ساعدني أنظّم خطة دراسة لهذا الأسبوع 📅",
  "اختبرني بأسئلة سريعة في موضوع 📝",
  "📸 صوّر سؤالاً أو صفحة وأنا أحلّها لك",
  "أعطني طريقة لحفظ معلومة بسهولة ✨",
  "عندي امتحان قريب وأنا متوتر 😟",
];

const STORAGE_KEY = "mirror-assistant-chat-v1";
const CAMERA_EXPLAINED_KEY = "nirolearn-camera-explained-v1";
// Sent back as context each turn (server caps at 16 turns).
const HISTORY_TURNS = 16;
const MAX_IMAGE_SIDE = 1600;
const THUMB_SIDE = 320;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = src;
  });
}

// Downsizes a photo to a JPEG data URL (phones produce 5–12 MB photos;
// ~1600px keeps text readable for the model at a fraction of the size).
async function toJpeg(src: string, maxSide: number, quality: number) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function prepareImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await toJpeg(url, MAX_IMAGE_SIDE, 0.85);
    const thumb = await toJpeg(url, THUMB_SIDE, 0.7);
    return { image, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveTurns(turns: Turn[]) {
  const trimmed = turns.slice(-60).map(({ image: _image, ...rest }) => rest);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded (many photos) — keep the text, drop the thumbnails.
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(trimmed.map(({ thumb: _thumb, ...rest }) => rest))
      );
    } catch {
      // Storage unavailable — the chat still works for this visit.
    }
  }
}

// The general مساعد AI: an open, ChatGPT-style assistant for ANY question,
// and for photos (a question from a paper, a slide, notes, a diagram…) —
// POST /api/assistant/chat, streamed. Asking about a specific file lives in
// the PDF reader's "اسأل AI" and the study sheets. The conversation is kept
// in this browser (localStorage) so leaving and coming back doesn't lose it.
export default function AssistantPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0];
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{
    image: string;
    thumb: string;
  } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming">(
    "idle"
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // Why we need the camera, shown once before the system asks for it.
  const [cameraInfoOpen, setCameraInfoOpen] = useState(false);

  function openCamera() {
    let explained = false;
    try {
      explained = localStorage.getItem(CAMERA_EXPLAINED_KEY) === "1";
    } catch {
      // Storage blocked — just explain again.
    }
    if (explained) cameraRef.current?.click();
    else setCameraInfoOpen(true);
  }

  function continueToCamera() {
    try {
      localStorage.setItem(CAMERA_EXPLAINED_KEY, "1");
    } catch {
      // Ignore — worst case the explanation shows again next time.
    }
    setCameraInfoOpen(false);
    cameraRef.current?.click();
  }
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
    if (!busy) saveTurns(turns);
  }, [turns, busy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, status]);

  // Grow the text box with its content (up to a cap, then it scrolls).
  useEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    // + borders, so a one-line box doesn't show a scrollbar.
    const borders = box.offsetHeight - box.clientHeight;
    box.style.height = `${Math.min(box.scrollHeight + borders, 160)}px`;
  }, [input]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function attach(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("أرفق صورة فقط (JPG أو PNG) 📸");
      return;
    }
    setError("");
    setPreparing(true);
    try {
      setAttachment(await prepareImage(file));
      inputRef.current?.focus();
    } catch {
      setError("تعذر قراءة الصورة، جرّب صورة أخرى 🙏");
    } finally {
      setPreparing(false);
    }
  }

  async function send(text: string) {
    const message = text.trim();
    const photo = attachment;
    if ((!message && !photo) || busy || preparing) return;
    // Text-only history, plus the latest earlier photo still in memory (so
    // "and question 2?" about the same photo works).
    const recent = turns
      .filter(turn => turn.content || turn.image || turn.thumb)
      .slice(-HISTORY_TURNS);
    const lastImageIndex = photo
      ? -1
      : recent.map(turn => !!turn.image).lastIndexOf(true);
    const history = recent.map((turn, index) => {
      const withImage = index === lastImageIndex && !!turn.image;
      return {
        role: turn.role,
        // A photo-only turn whose image is no longer in memory (restored
        // from storage) still needs non-empty text for the model.
        content: (
          turn.content || (turn.thumb && !withImage ? "[أرسلت صورة]" : "")
        ).slice(0, 8000),
        ...(withImage ? { image: turn.image } : {}),
      };
    });
    setTurns(current => [
      ...current,
      {
        role: "user",
        content: message,
        ...(photo ? { image: photo.image, thumb: photo.thumb } : {}),
      },
    ]);
    setInput("");
    setAttachment(null);
    setError("");
    setStatus("waiting");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          ...(photo ? { image: photo.image } : {}),
          history,
        }),
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
      if (controller.signal.aborted) {
        // Stopped by the student: keep whatever was already written.
        setTurns(current =>
          current.at(-1)?.role === "assistant" && !current.at(-1)?.content
            ? current.slice(0, -1)
            : current
        );
        return;
      }
      // Drop the unanswered question (and any empty bubble) so a retry
      // doesn't duplicate it — and give the text/photo back to resend.
      setTurns(current => {
        const trimmed = [...current];
        while (
          trimmed.length &&
          trimmed[trimmed.length - 1].role === "assistant" &&
          !trimmed[trimmed.length - 1].content
        ) {
          trimmed.pop();
        }
        if (trimmed[trimmed.length - 1]?.role === "user") trimmed.pop();
        return trimmed;
      });
      setInput(message);
      setAttachment(photo);
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

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    abortRef.current?.abort();
    setTurns([]);
    setError("");
    setAttachment(null);
    setStatus("idle");
  }

  async function copy(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      setTimeout(
        () => setCopied(current => (current === index ? null : current)),
        1500
      );
    } catch {
      // Clipboard blocked — nothing to do.
    }
  }

  return (
    <section className="assistant-chat">
      <header className="assistant-chat-header">
        <div className="assistant-chat-avatar">
          <Sparkles size={22} />
        </div>
        <div className="assistant-chat-title">
          <strong>مساعد NiroLearn</strong>
          <small>اسألني أي شيء أو أرسل صورة — أنا هنا لأساعدك 😊</small>
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

      <div className="assistant-chat-messages" aria-live="polite">
        {!turns.length && (
          <div className="assistant-chat-welcome">
            <p className="assistant-chat-hello">
              أهلاً{firstName ? ` ${firstName}` : ""}! 👋✨
            </p>
            <p>
              اسألني عن أي شيء: شرح، حل مسائل، ترجمة، كتابة، خطة دراسة… أو صوّر
              سؤالاً أو صفحة وأنا أحلّلها لك 📸
            </p>
            <div className="assistant-chat-starters">
              {STARTERS.map(starter => (
                <button
                  type="button"
                  key={starter}
                  className="quiz-pill"
                  onClick={() =>
                    starter.startsWith("📸") ? openCamera() : send(starter)
                  }
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div key={index} dir="auto" className="study-ai-message is-user">
              {(turn.thumb || turn.image) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="assistant-chat-photo"
                  src={turn.thumb || turn.image}
                  alt="الصورة المرسلة"
                />
              )}
              {turn.content}
            </div>
          ) : !turn.content ? null : (
            <div key={index} className="study-ai-message assistant-answer">
              <RichText text={turn.content} />
              {!(busy && index === turns.length - 1) && (
                <button
                  type="button"
                  className="assistant-copy"
                  onClick={() => copy(index, turn.content)}
                  aria-label="نسخ الإجابة"
                >
                  {copied === index ? <Check size={14} /> : <Copy size={14} />}
                  {copied === index ? "تم النسخ" : "نسخ"}
                </button>
              )}
            </div>
          )
        )}
        {status === "waiting" && (
          <div className="study-ai-status">
            <Loader2 size={16} className="spin" />{" "}
            {turns.at(-1)?.image ? "يحلّل الصورة... 🔍" : "يفكّر... 🤔"}
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
        {(attachment || preparing) && (
          <div className="assistant-attachment">
            {preparing ? (
              <Loader2 size={18} className="spin" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment!.thumb} alt="الصورة المرفقة" />
            )}
            {attachment && (
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="إزالة الصورة"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <div className="assistant-input-row">
          <button
            type="button"
            className="assistant-attach"
            onClick={openCamera}
            disabled={busy || preparing}
            aria-label="تصوير بالكاميرا"
          >
            <Camera size={20} />
          </button>
          <button
            type="button"
            className="assistant-attach"
            onClick={() => fileRef.current?.click()}
            disabled={busy || preparing}
            aria-label="اختيار صورة من المعرض"
          >
            <ImagePlus size={20} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={event => {
              attach(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {/* capture → opens the camera directly (on phones / the app). */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={event => {
              attach(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <textarea
            ref={inputRef}
            rows={1}
            dir="auto"
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                send(input);
              }
            }}
            onPaste={event => {
              const file = Array.from(event.clipboardData.files).find(item =>
                item.type.startsWith("image/")
              );
              if (file) {
                event.preventDefault();
                attach(file);
              }
            }}
            placeholder={
              attachment ? "اسأل عن الصورة (اختياري)..." : "اكتب سؤالك هنا..."
            }
            aria-label="رسالتك"
            enterKeyHint="send"
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="إيقاف">
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!input.trim() && !attachment) || preparing}
              aria-label="إرسال"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </form>

      {cameraInfoOpen && (
        <div
          className="upload-chooser-backdrop"
          onClick={() => setCameraInfoOpen(false)}
        >
          <div
            className="upload-chooser-sheet permission-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-info-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="upload-chooser-handle" />
            <span className="permission-icon" aria-hidden="true">
              <Camera size={26} />
            </span>
            <h2 id="camera-info-title">نحتاج الكاميرا لتصوير سؤالك 📷</h2>
            <ul>
              <li>صوّر سؤالًا أو صفحة أو ملاحظاتك، والمساعد يقرؤها ويحلّها.</li>
              <li>تُفتح الكاميرا فقط عندما تضغط الزر — لا شيء في الخلفية.</li>
              <li>الصورة تُرسل للتحليل فقط ولا نخزّنها على خوادمنا.</li>
              <li>إذا رفضت الإذن يمكنك دائمًا اختيار صورة من المعرض.</li>
            </ul>
            <div className="permission-actions">
              <button
                type="button"
                className="primary-button"
                onClick={continueToCamera}
              >
                متابعة
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCameraInfoOpen(false)}
              >
                ليس الآن
              </button>
            </div>
            <a href="/privacy#permissions" className="permission-more">
              المزيد في سياسة الخصوصية
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
