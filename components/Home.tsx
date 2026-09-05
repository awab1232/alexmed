"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  KeyRound,
  Languages,
  Layers3,
  Library,
  Lightbulb,
  Loader2,
  RotateCcw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  Volume2,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import AppSidebar from "@/components/AppSidebar";

type PageText = { page: number; text: string; hasText: boolean; ocr?: boolean };
type Card = {
  id: string;
  question: string;
  questionArabic: string;
  answer: string;
  answerArabic: string;
  explanation: string;
  explanationArabic: string;
  keyIdea: string;
  keyIdeaArabic: string;
  keyword: string;
  keywordArabic: string;
  sourcePage: number;
  status: "complete" | "needs_review";
  confidence: "high" | "medium" | "low";
};

type View = "upload" | "cards" | "library";
type Stage = "idle" | "extracting" | "processing" | "ready";
const UPLOAD_MAX_MB = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB) || 250;

const depthOptions = [
  { value: "quick", label: "سريع", caption: "مراجعة خاطفة" },
  { value: "balanced", label: "متوازن", caption: "الأفضل للامتحان" },
  { value: "detailed", label: "مفصّل", caption: "شرح أعمق" },
];

const sampleFeatures = [
  {
    icon: ScanText,
    title: "لا سؤال يضيع",
    text: "يفحص كل صفحة ويعرض الصفحات التي تحتاج مراجعة.",
  },
  {
    icon: Languages,
    title: "English + عربي",
    text: "سؤال، إجابة، شرح، وفكرة رئيسية باللغتين.",
  },
  {
    icon: KeyRound,
    title: "كلمة تقودك",
    text: "يبرز clue أو trigger word الذي يبني عليه الجواب.",
  },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [currentFileName, setCurrentFileName] = useState("");
  const [pages, setPages] = useState<PageText[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [fileUrl, setFileUrl] = useState("");
  const [openDeckId, setOpenDeckId] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const [processedPages, setProcessedPages] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [view, setView] = useState<View>("upload");
  const [depth, setDepth] = useState("balanced");
  const [activeCard, setActiveCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [speakingTarget, setSpeakingTarget] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const decksQuery = trpc.decks.list.useQuery(undefined, {
    enabled: view === "library",
  });
  const deleteDeckMutation = trpc.decks.delete.useMutation({
    onSuccess: () => {
      utils.decks.list.invalidate();
    },
  });

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // A مِرآة generation job (see app/mirror/[jobId]/page.tsx) redirects here
  // with ?openDeck=<id> once it graduates into a real deck, so the user
  // lands on the same "cards" browsing view they used to see immediately
  // after generation finished, instead of an empty upload screen.
  useEffect(() => {
    const deckId = searchParams.get("openDeck");
    if (!deckId) return;
    router.replace("/");
    openDeck(deckId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function speakEnglish(text: string, target: string) {
    if (!text.trim()) return;
    if (!("speechSynthesis" in window)) {
      setError("النطق الصوتي غير مدعوم في هذا المتصفح.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingTarget(null);
    utterance.onerror = () => setSpeakingTarget(null);
    setSpeakingTarget(target);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeakingTarget(null);
  }

  const visibleCards = cards.filter(card => {
    const haystack =
      `${card.question} ${card.questionArabic} ${card.answer} ${card.keyIdea} ${card.keyword}`.toLowerCase();
    return (
      (!query.trim() || haystack.includes(query.toLowerCase())) &&
      (!onlyReview || card.status === "needs_review")
    );
  });
  const selectedCard = visibleCards[activeCard] ?? visibleCards[0];
  const progress = pageCount
    ? Math.min(100, Math.round((processedPages / pageCount) * 100))
    : 0;

  function chooseFile(nextFile: File | undefined) {
    setError("");
    setWarning("");
    if (!nextFile) return;
    if (
      nextFile.type !== "application/pdf" &&
      !nextFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("اختَر ملف PDF فقط.");
      return;
    }
    if (nextFile.size > UPLOAD_MAX_MB * 1024 * 1024) {
      setError(`حجم الملف أكبر من ${UPLOAD_MAX_MB}MB في النسخة الحالية.`);
      return;
    }
    setFile(nextFile);
    setCurrentFileName(nextFile.name);
    setOpenDeckId(null);
    setStage("idle");
    setCards([]);
    setPages([]);
    setProcessedPages(0);
    setPageCount(0);
    setFileUrl("");
  }

  // Upload + extract + OCR + generation all now live on the server (Item D
  // of the reliability plan) so progress survives a closed tab or a
  // different device — this function's only job is to hand the file to
  // /api/mirror/upload-and-plan and send the user to the resumable
  // /mirror/[jobId] page, which drives batch generation the same way
  // app/books/[bookId]/page.tsx drives chapter analysis.
  async function startProcessing() {
    if (!file) return;
    setError("");
    setWarning("");
    setStage("extracting");

    try {
      const uploadUrlResponse = await fetch("/api/pdf/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "application/pdf",
        }),
      });
      const uploadData = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok)
        throw new Error(uploadData.error || "تعذر تجهيز رابط الرفع.");

      const putResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!putResponse.ok)
        throw new Error(
          "تعذر رفع الملف للتخزين. تحقق من الاتصال وحاول مرة أخرى."
        );

      const planResponse = await fetch("/api/mirror/upload-and-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: uploadData.key,
          fileName: file.name,
          depth,
        }),
      });
      const planned = await planResponse.json();
      if (!planResponse.ok)
        throw new Error(planned.error || "تعذر تجهيز الملف للتوليد.");

      router.push(`/mirror/${planned.jobId}`);
    } catch (processingError) {
      setStage("idle");
      setError(
        processingError instanceof Error
          ? processingError.message
          : "حدث خطأ غير متوقع."
      );
    }
  }

  function reset() {
    setFile(null);
    setCurrentFileName("");
    setOpenDeckId(null);
    setPages([]);
    setCards([]);
    setPageCount(0);
    setFileUrl("");
    setProcessedPages(0);
    setStage("idle");
    setView("upload");
    setError("");
    setWarning("");
    setQuery("");
    setOnlyReview(false);
    setActiveCard(0);
    setShowAnswer(false);
  }

  async function openDeck(deckId: string) {
    setLibraryError("");
    try {
      const result = await utils.decks.get.fetch({ id: deckId });
      setFile(null);
      setCurrentFileName(result.deck.fileName);
      setOpenDeckId(result.deck.id);
      setPageCount(result.deck.pageCount);
      setPages([]);
      setFileUrl("");
      setCards(result.cards);
      setDepth(result.deck.depth);
      setProcessedPages(result.deck.pageCount);
      setStage("ready");
      setView("cards");
      setQuery("");
      setOnlyReview(false);
      setActiveCard(0);
      setShowAnswer(false);
    } catch {
      setLibraryError("تعذر فتح هذا الملف. حاول مرة أخرى.");
    }
  }

  async function removeDeck(deckId: string) {
    setLibraryError("");
    try {
      await deleteDeckMutation.mutateAsync({ id: deckId });
      if (openDeckId === deckId) reset();
    } catch {
      setLibraryError("تعذر حذف هذا الملف. حاول مرة أخرى.");
    }
  }

  function downloadCsv() {
    if (!cards.length) return;
    const header = [
      "Question EN",
      "Question AR",
      "Answer EN",
      "Answer AR",
      "Explanation EN",
      "Explanation AR",
      "Key idea",
      "Keyword",
      "Page",
      "Status",
    ];
    const rows = cards.map(card => [
      card.question,
      card.questionArabic,
      card.answer,
      card.answerArabic,
      card.explanation,
      card.explanationArabic,
      card.keyIdea,
      card.keyword,
      String(card.sourcePage),
      card.status,
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentFileName.replace(/\.pdf$/i, "") || "study-cards"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function goToCard(direction: number) {
    if (!visibleCards.length) return;
    stopSpeaking();
    setActiveCard(
      current =>
        (current + direction + visibleCards.length) % visibleCards.length
    );
    setShowAnswer(false);
  }

  return (
    <div className="app-shell">
      <AppSidebar
        activeMiratView={view}
        miratCardsCount={cards.length}
        miratReviewCount={
          cards.filter(card => card.status === "needs_review").length
        }
        onMiratNavigate={(nextView, options) => {
          setView(nextView);
          setOnlyReview(options?.onlyReview ?? false);
          setActiveCard(0);
        }}
      />

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>مِرآة</span>
            <span className="slash">/</span>
            <strong>
              {view === "upload"
                ? "ملف جديد"
                : view === "library"
                  ? "مكتبتي"
                  : "بطاقات المذاكرة"}
            </strong>
          </div>
          <div className="topbar-note">
            <Sparkles size={15} /> bilingual learning workspace
          </div>
        </header>

        {view === "upload" && (
          <section className="upload-view">
            <div className="intro-grid">
              <div className="intro-copy">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> من ملف طويل إلى مذاكرة أذكى
                </div>
                <h1>
                  خلي كل سؤال
                  <br />
                  <em>يثبت بدماغك.</em>
                </h1>
                <p className="intro-lede">
                  ارفع أسئلة مادتك، ومِرآة ترتّبها لك كروتًا واضحة: السؤال،
                  الجواب، الفكرة، والكلمة المفتاحية — بالعربي والإنجليزي.
                </p>
              </div>
              <div className="intro-stamp">
                <div className="stamp-top">BUILT FOR</div>
                <strong>
                  EXAM
                  <br />
                  WEEK
                </strong>
                <div className="stamp-line" />
                <span>focus on the clue</span>
              </div>
            </div>

            <div className="feature-strip">
              {sampleFeatures.map(({ icon: Icon, title, text }) => (
                <div className="feature-item" key={title}>
                  <div className="feature-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="workspace-grid">
              <div className="upload-card panel-card">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">01 / UPLOAD</span>
                    <h2>ابدأ بملف الأسئلة</h2>
                  </div>
                  <FileText size={23} className="heading-icon" />
                </div>
                <div
                  className={dragActive ? "drop-zone drag-active" : "drop-zone"}
                  onDragOver={event => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={event => {
                    event.preventDefault();
                    setDragActive(false);
                    chooseFile(event.dataTransfer.files?.[0]);
                  }}
                  onClick={() => inputRef.current?.click()}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={event => chooseFile(event.target.files?.[0])}
                  />
                  <div className="upload-icon">
                    <Upload size={23} />
                  </div>
                  <strong>{file ? file.name : "اسحب ملف PDF هنا"}</strong>
                  <span>
                    {file
                      ? `${formatBytes(file.size)} · جاهز للتحليل`
                      : "أو اضغط لاختيار الملف من جهازك"}
                  </span>
                  {!file && (
                    <small>
                      حد أقصى {UPLOAD_MAX_MB}MB · يدعم الملفات الكبيرة والدفعات
                      المتعددة وPDF المصوّر عبر OCR
                    </small>
                  )}
                </div>
                {file && (
                  <div className="selected-file">
                    <div className="selected-file-icon">
                      <FileText size={18} />
                    </div>
                    <div>
                      <strong>{file.name}</strong>
                      <span>{formatBytes(file.size)} · PDF</span>
                    </div>
                    <button
                      type="button"
                      aria-label="إزالة الملف"
                      onClick={event => {
                        event.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {error && (
                  <div className="inline-alert error">
                    <CircleAlert size={16} />
                    {error}
                  </div>
                )}
                {warning && (
                  <div className="inline-alert warning">
                    <CircleAlert size={16} />
                    {warning}
                  </div>
                )}
                {stage === "extracting" && (
                  <div
                    className="live-progress"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="progress-heading">
                      <div className="progress-orbit">
                        <ScanText size={17} />
                      </div>
                      <div>
                        <strong>نرفع الملف ونجهّزه للتوليد</strong>
                        <span>
                          هتنقل تلقائيًا لصفحة التقدّم فور اكتمال الرفع — تقدر
                          تسكّر الصفحة وترجع بعدين من أي جهاز.
                        </span>
                      </div>
                    </div>
                    <div className="progress-dots">
                      <span /> <span /> <span />
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-card panel-card">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">02 / STYLE</span>
                    <h2>شكل البطاقة</h2>
                  </div>
                  <Sparkles size={23} className="heading-icon" />
                </div>
                <p className="setting-description">
                  اختر مستوى الشرح المناسب لوقت مذاكرتك.
                </p>
                <div className="depth-options">
                  {depthOptions.map(option => (
                    <button
                      type="button"
                      key={option.value}
                      className={
                        depth === option.value
                          ? "depth-option selected"
                          : "depth-option"
                      }
                      onClick={() => setDepth(option.value)}
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
                <div className="language-note">
                  <Languages size={17} />
                  <div>
                    <strong>كل شيء بلغتين</strong>
                    <span>English first · الترجمة العربية بجانبه</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!file || stage === "extracting"}
                  onClick={startProcessing}
                >
                  {stage === "extracting" ? (
                    <>
                      <Loader2 size={18} className="spin" /> جاري الرفع...
                    </>
                  ) : (
                    <>
                      حوّل إلى بطاقات <ArrowUp size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="disclaimer">
              <ShieldCheck size={15} /> أداة مساعدة للمذاكرة وليست بديلًا عن
              مرجع المادة أو توجيهًا طبيًا. راجع البطاقات ذات العلامة الصفراء.
            </p>
          </section>
        )}

        {view === "cards" && (
          <section className="cards-view">
            <div className="cards-header">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-dot green" /> جلسة المذاكرة جاهزة
                </div>
                <h1>
                  بطاقاتك <em>تتكلم.</em>
                </h1>
                <p>
                  {currentFileName || "ملف الأسئلة"} · {pageCount} صفحة ·{" "}
                  {cards.length} بطاقة مولّدة
                </p>
              </div>
              <div className="header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={downloadCsv}
                  disabled={!cards.length}
                >
                  <Download size={16} /> تصدير CSV
                </button>
                <button type="button" className="ghost-button" onClick={reset}>
                  <RotateCcw size={16} /> ملف جديد
                </button>
              </div>
            </div>
            {warning && (
              <div className="inline-alert warning wide">
                <CircleAlert size={16} />
                {warning}
              </div>
            )}
            <div className="stats-row">
              <div className="stat-card">
                <span>البطاقات</span>
                <strong>{cards.length}</strong>
                <small>بطاقة قابلة للمراجعة</small>
              </div>
              <div className="stat-card">
                <span>تغطية الصفحات</span>
                <strong>
                  {processedPages}/{pageCount}
                </strong>
                <small>
                  {pageCount ? `${progress}% من الملف` : "بانتظار الملف"}
                </small>
              </div>
              <div className="stat-card accent">
                <span>تحتاج تدقيقًا</span>
                <strong>
                  {cards.filter(card => card.status === "needs_review").length}
                </strong>
                <small>أسئلة ناقصة أو غير واضحة</small>
              </div>
            </div>
            <div className="cards-toolbar">
              <div className="search-box">
                <span>⌕</span>
                <input
                  value={query}
                  onChange={event => {
                    setQuery(event.target.value);
                    setActiveCard(0);
                  }}
                  placeholder="ابحث في السؤال أو الكلمة المفتاحية..."
                />
              </div>
              <button
                type="button"
                className={
                  onlyReview ? "filter-button active" : "filter-button"
                }
                onClick={() => {
                  setOnlyReview(current => !current);
                  setActiveCard(0);
                }}
              >
                <CircleAlert size={15} />{" "}
                {onlyReview ? "كل البطاقات" : "تحتاج مراجعة فقط"}
              </button>
            </div>
            {stage !== "ready" && (
              <div className="processing-banner">
                <Loader2 size={18} className="spin" />
                <div>
                  <strong>نحوّل الملف إلى بطاقات...</strong>
                  <span>
                    اكتملت معالجة {processedPages} من {pageCount} صفحة
                  </span>
                </div>
                <div className="small-progress">
                  <i style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {!selectedCard ? (
              <div className="empty-state">
                <Layers3 size={28} />
                <h3>لا توجد بطاقات هنا</h3>
                <p>جرّب إزالة البحث أو فلتر المراجعة.</p>
              </div>
            ) : (
              <div className="review-layout">
                <div className="card-list">
                  {visibleCards.map((card, index) => (
                    <button
                      key={card.id}
                      className={
                        selectedCard.id === card.id
                          ? "list-card selected"
                          : "list-card"
                      }
                      type="button"
                      onClick={() => {
                        setActiveCard(index);
                        setShowAnswer(false);
                      }}
                    >
                      <span className="list-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="list-copy">
                        <strong>{card.questionArabic || card.question}</strong>
                        <small>
                          صفحة {card.sourcePage} ·{" "}
                          {card.keywordArabic || card.keyword}
                        </small>
                      </span>
                      {card.status === "needs_review" ? (
                        <CircleAlert size={16} className="list-alert" />
                      ) : (
                        <CheckCircle2 size={16} className="list-check" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flashcard-wrap">
                  <div className="flashcard-meta">
                    <span>
                      بطاقة{" "}
                      {String(visibleCards.indexOf(selectedCard) + 1).padStart(
                        2,
                        "0"
                      )}{" "}
                      من {String(visibleCards.length).padStart(2, "0")}
                    </span>
                    <span
                      className={
                        selectedCard.status === "needs_review"
                          ? "review-pill"
                          : "complete-pill"
                      }
                    >
                      {selectedCard.status === "needs_review" ? (
                        <>
                          <CircleAlert size={13} /> تحتاج مراجعة
                        </>
                      ) : (
                        <>
                          <Check size={13} /> واضحة
                        </>
                      )}
                    </span>
                  </div>
                  <article className="flashcard">
                    <div className="flashcard-topline">
                      <span className="card-tag">
                        QUESTION · PAGE {selectedCard.sourcePage}
                      </span>
                      <span className="card-confidence">
                        {selectedCard.confidence} confidence
                      </span>
                    </div>
                    <div className="question-block">
                      <span className="micro-label">السؤال / QUESTION</span>
                      <h2>{selectedCard.questionArabic}</h2>
                      <p>{selectedCard.question}</p>
                    </div>
                    <div
                      className={
                        showAnswer ? "answer-block revealed" : "answer-block"
                      }
                    >
                      {showAnswer ? (
                        <>
                          <span className="micro-label">
                            الإجابة والشرح / ANSWER & WHY
                          </span>
                          <div className="answer-pair">
                            <strong>{selectedCard.answerArabic}</strong>
                            <span>{selectedCard.answer}</span>
                          </div>
                          <div className="explanation-pair">
                            <p>{selectedCard.explanationArabic}</p>
                            <p>{selectedCard.explanation}</p>
                          </div>
                          <div className="concept-grid">
                            <div>
                              <span>
                                <Lightbulb size={14} /> الفكرة الأساسية
                              </span>
                              <strong>{selectedCard.keyIdeaArabic}</strong>
                              <small>{selectedCard.keyIdea}</small>
                            </div>
                            <div>
                              <span>
                                <KeyRound size={14} /> الكلمة المفتاحية
                              </span>
                              <strong>{selectedCard.keywordArabic}</strong>
                              <small>{selectedCard.keyword}</small>
                            </div>
                          </div>
                        </>
                      ) : (
                        <button
                          className="reveal-button"
                          type="button"
                          onClick={() => setShowAnswer(true)}
                        >
                          <span className="reveal-icon">?</span>
                          <strong>اظهر الإجابة والشرح</strong>
                          <small>Reveal answer & explanation</small>
                        </button>
                      )}
                    </div>
                  </article>
                  <div className="card-navigation">
                    <button type="button" onClick={() => goToCard(-1)}>
                      <ChevronRight size={17} /> السابقة
                    </button>
                    <button
                      type="button"
                      className="next"
                      onClick={() => goToCard(1)}
                    >
                      التالية <ChevronLeft size={17} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {view === "library" && (
          <section className="upload-view">
            <div className="cards-header">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> ملفاتك المحفوظة
                </div>
                <h1>
                  مكتبتك <em>دائمًا هنا.</em>
                </h1>
                <p>افتح أي ملف سابق وشاهد بطاقاته من غير ما تعيد الرفع.</p>
              </div>
            </div>
            {libraryError && (
              <div className="inline-alert error wide">
                <CircleAlert size={16} />
                {libraryError}
              </div>
            )}
            {decksQuery.isError ? (
              <div className="empty-state">
                <CircleAlert size={28} />
                <h3>تعذر تحميل مكتبتك</h3>
                <p>تحقق من اتصالك وحاول مرة أخرى.</p>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ marginTop: 14 }}
                  onClick={() => decksQuery.refetch()}
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : decksQuery.isLoading ? (
              <div className="empty-state">
                <Loader2 size={28} className="spin" />
                <h3>جاري تحميل مكتبتك...</h3>
              </div>
            ) : !decksQuery.data?.length ? (
              <div className="empty-state">
                <Library size={28} />
                <h3>مكتبتك فارغة</h3>
                <p>ارفع ملفك الأول وسيظهر هنا تلقائيًا بعد التوليد.</p>
              </div>
            ) : (
              <div className="library-grid">
                {decksQuery.data.map(deck => (
                  <div className="library-item" key={deck.id}>
                    <div className="library-item-icon">
                      <FileText size={18} />
                    </div>
                    <div className="library-item-meta">
                      <strong>{deck.fileName}</strong>
                      <span>
                        {deck.pageCount} صفحة · {deck.cardCount} بطاقة ·{" "}
                        {new Date(deck.createdAt).toLocaleDateString("ar")}
                      </span>
                    </div>
                    <div className="library-item-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openDeck(deck.id)}
                      >
                        فتح
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        aria-label="حذف"
                        onClick={() => removeDeck(deck.id)}
                        disabled={deleteDeckMutation.isPending}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
