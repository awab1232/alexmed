"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  CircleAlert,
  ClipboardPaste,
  FilePlus2,
  Layers3,
  Loader2,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  MIRROR_TEXT_MAX_CHARS,
  MIRROR_TEXT_MIN_CHARS,
  estimateQuestionCount,
  normalizeQuestionText,
} from "@/lib/mirror-text";

// مِرآة's "paste question text" input — the alternative to uploading a PDF.
// The student pastes their questions, then is asked every time where the
// cards should go: a brand-new file, or an addition to one of their existing
// files (added as its own separate set of cards inside it, never merged with
// or replacing what the file already has). Submitting hands off to the same
// /mirror/[jobId] progress page as a PDF upload.

const DRAFT_KEY = "mirror:text-draft";
const DRAFT_SAVE_DELAY_MS = 400;

type Destination = "new" | "append";
type Depth = "quick" | "balanced" | "detailed";

export default function MirrorTextInput({
  depth,
  depthOptions,
  onDepthChange,
  initialDeckId,
}: {
  depth: string;
  depthOptions: { value: string; label: string; caption: string }[];
  onDepthChange: (depth: string) => void;
  // Set when the student came from a specific file's "إضافة أسئلة" button, so
  // that file is preselected as the destination (they are still asked).
  initialDeckId: string | null;
}) {
  const router = useRouter();
  const decksQuery = trpc.decks.list.useQuery();
  const submit = trpc.mirror.submitText.useMutation();
  const decks = decksQuery.data ?? [];

  const [text, setText] = useState("");
  const [destination, setDestination] = useState<Destination>(
    initialDeckId ? "append" : "new"
  );
  const [deckId, setDeckId] = useState(initialDeckId ?? "");
  const [title, setTitle] = useState("");
  const [additionTitle, setAdditionTitle] = useState("");
  const [error, setError] = useState("");
  const draftLoaded = useRef(false);

  // The selected deck falls back to the first one until the student picks
  // (or until the list arrives, when they came in with append preselected).
  const effectiveDeckId = deckId || decks[0]?.id || "";
  const normalized = normalizeQuestionText(text);
  const estimate = estimateQuestionCount(normalized);
  const overLimit = normalized.length > MIRROR_TEXT_MAX_CHARS;
  const canSubmit =
    !submit.isPending &&
    normalized.length >= MIRROR_TEXT_MIN_CHARS &&
    !overLimit &&
    (destination === "new" || !!effectiveDeckId);

  // Restore an unsent draft (a long paste shouldn't be lost to a refresh or
  // an accidental navigation) and keep it saved as the student edits.
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) setText(draft);
    } catch {
      // Storage can be blocked (private mode) — the form works without it.
    }
    draftLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!draftLoaded.current) return;
    const timer = setTimeout(() => {
      try {
        if (text) localStorage.setItem(DRAFT_KEY, text);
        else localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Ignore — see above.
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  async function pasteFromClipboard() {
    setError("");
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted.trim()) {
        setText(current => (current ? `${current}\n\n` : "") + pasted);
      }
    } catch {
      setError("تعذّرت القراءة من الحافظة. الصق النص يدويًا داخل الصندوق.");
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setError("");
    try {
      const result = await submit.mutateAsync({
        text,
        depth: depth as Depth,
        target:
          destination === "new"
            ? { mode: "new", title: title.trim() || undefined }
            : {
                mode: "append",
                deckId: effectiveDeckId,
                title: additionTitle.trim() || undefined,
              },
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Ignore — see above.
      }
      router.push(`/mirror/${result.jobId}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "تعذّر إرسال الأسئلة. حاول مرة أخرى."
      );
    }
  }

  return (
    <div className="text-input-card panel-card">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">01 / PASTE</span>
          <h2>الصق نص الأسئلة</h2>
        </div>
        <ClipboardPaste size={23} className="heading-icon" />
      </div>
      <p className="setting-description">
        الصق أسئلتك كما هي (إنجليزي أو عربي، مرقّمة أو لا) وسنحوّلها إلى نفس
        البطاقات التي نصنعها من ملفات PDF.
      </p>

      <label htmlFor="mirror-text-area" className="text-input-label">
        نص الأسئلة
      </label>
      <textarea
        id="mirror-text-area"
        className="text-input-area"
        dir="auto"
        value={text}
        onChange={event => setText(event.target.value)}
        placeholder={
          "1. What is the first-line treatment of ...?\nA. ...\nB. ...\n\n2. ..."
        }
        rows={12}
        spellCheck={false}
      />
      <div className="text-input-meta">
        <span
          className={overLimit ? "text-input-count over" : "text-input-count"}
        >
          {normalized.length.toLocaleString("en")} /{" "}
          {MIRROR_TEXT_MAX_CHARS.toLocaleString("en")} حرف
        </span>
        {estimate > 0 && <span>≈ {estimate} سؤال</span>}
        <span className="text-input-meta-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={pasteFromClipboard}
          >
            <ClipboardPaste size={15} /> لصق
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setText("")}
            disabled={!text}
          >
            <Trash2 size={15} /> مسح
          </button>
        </span>
      </div>
      {overLimit && (
        <div className="inline-alert error wide">
          <CircleAlert size={16} />
          النص أطول من الحد المسموح. قسّمه على دفعتين وأضف الثانية لنفس الملف.
        </div>
      )}

      <div className="panel-heading text-input-section">
        <div>
          <span className="section-kicker">02 / DESTINATION</span>
          <h2>أين نحفظ هذه الأسئلة؟</h2>
        </div>
      </div>
      <div
        className="destination-grid"
        role="radiogroup"
        aria-label="وجهة الأسئلة"
      >
        <div
          className={
            destination === "new"
              ? "destination-option selected"
              : "destination-option"
          }
        >
          <button
            type="button"
            role="radio"
            aria-checked={destination === "new"}
            className="destination-head"
            onClick={() => setDestination("new")}
          >
            <span className="radio-dot" />
            <FilePlus2 size={18} />
            <span>
              <strong>ملف جديد</strong>
              <small>مجموعة بطاقات مستقلة بعنوانها</small>
            </span>
          </button>
          {destination === "new" && (
            <div className="destination-fields">
              <label htmlFor="mirror-new-title">اسم الملف</label>
              <input
                id="mirror-new-title"
                value={title}
                maxLength={120}
                onChange={event => setTitle(event.target.value)}
                placeholder="مثال: أسئلة الفصل الثالث"
              />
            </div>
          )}
        </div>

        <div
          className={
            destination === "append"
              ? "destination-option selected"
              : "destination-option"
          }
        >
          <button
            type="button"
            role="radio"
            aria-checked={destination === "append"}
            className="destination-head"
            disabled={!decks.length}
            onClick={() => setDestination("append")}
          >
            <span className="radio-dot" />
            <Layers3 size={18} />
            <span>
              <strong>إضافة لملف موجود</strong>
              <small>
                {decks.length
                  ? "بطاقات منفصلة داخل الملف دون المساس بالسابقة"
                  : decksQuery.isLoading
                    ? "جاري تحميل ملفاتك..."
                    : "لا توجد ملفات بعد"}
              </small>
            </span>
          </button>
          {destination === "append" && decks.length > 0 && (
            <div className="destination-fields">
              <label htmlFor="mirror-target-deck">الملف</label>
              <select
                id="mirror-target-deck"
                value={effectiveDeckId}
                onChange={event => setDeckId(event.target.value)}
              >
                {decks.map(deck => (
                  <option key={deck.id} value={deck.id}>
                    {deck.fileName} · {deck.cardCount} بطاقة
                  </option>
                ))}
              </select>
              <label htmlFor="mirror-addition-title">
                اسم هذه الإضافة (اختياري)
              </label>
              <input
                id="mirror-addition-title"
                value={additionTitle}
                maxLength={120}
                onChange={event => setAdditionTitle(event.target.value)}
                placeholder="مثال: أسئلة إضافية — الأسبوع الثاني"
              />
            </div>
          )}
        </div>
      </div>

      <div className="panel-heading text-input-section">
        <div>
          <span className="section-kicker">03 / STYLE</span>
          <h2>شكل البطاقة</h2>
        </div>
      </div>
      <div className="depth-options">
        {depthOptions.map(option => (
          <button
            type="button"
            key={option.value}
            className={
              depth === option.value ? "depth-option selected" : "depth-option"
            }
            onClick={() => onDepthChange(option.value)}
          >
            <span className="radio-dot" />
            <span>
              <strong>{option.label}</strong>
              <small>{option.caption}</small>
            </span>
            {option.value === "balanced" && (
              <b className="recommended">موصى به</b>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="inline-alert error wide">
          <CircleAlert size={16} />
          {error}
        </div>
      )}
      <button
        type="button"
        className="primary-button"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {submit.isPending ? (
          <>
            <Loader2 size={18} className="spin" /> جاري الإرسال...
          </>
        ) : (
          <>
            حوّل إلى بطاقات <ArrowUp size={18} />
          </>
        )}
      </button>
    </div>
  );
}
