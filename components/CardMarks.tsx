"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Check,
  CircleAlert,
  Eraser,
  Highlighter,
  Loader2,
  MousePointer2,
  PenLine,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  ERASER_RADIUS,
  HIGHLIGHT_COLORS,
  MAX_HIGHLIGHTS,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  PEN_COLORS,
  PEN_WIDTH,
  addHighlight,
  appendPoint,
  emptyMarks,
  eraseStrokesAt,
  isEmptyMarks,
  newMarkId,
  segmentText,
  strokePath,
  type CardMarks,
  type Highlight,
  type MarkField,
  type Stroke,
  type StrokePoint,
} from "@/lib/card-marks";

// تضليل / قلم / ممحاة for a مِرآة flashcard. <MarkingSurface> wraps the card
// and owns the toolbar, the pen/eraser canvas and auto-saving; <MarkableText>
// marks each highlightable text field inside the card. The data model and
// its merge/erase logic live in lib/card-marks.ts.

type Tool = "none" | "highlight" | "pen" | "eraser";
type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 700;
const TOOL_HINTS: Record<Tool, string> = {
  none: "",
  highlight: "حدّد أي نص على البطاقة لتظليله باللون المختار.",
  pen: "ارسم بحرّية فوق البطاقة لتحديد النقاط المهمة.",
  eraser: "مرّر على التظليل أو الرسم لمسحه.",
};

const MarkContext = createContext<{ highlights: Highlight[]; tool: Tool }>({
  highlights: [],
  tool: "none",
});

// One highlightable text field of the card. Renders `text` unchanged when
// nothing is highlighted, so it is safe to use everywhere a card field is
// shown. `data-mark-field` is what selection handling uses to turn a DOM
// selection back into character offsets into `text`.
export function MarkableText({
  field,
  text,
}: {
  field: MarkField;
  text: string;
}) {
  const { highlights, tool } = useContext(MarkContext);
  const own = highlights.filter(h => h.field === field);
  return (
    <span data-mark-field={field}>
      {own.length === 0
        ? text
        : segmentText(text, own).map((segment, index) =>
            segment.highlight ? (
              <mark
                key={index}
                data-mark-id={segment.highlight.id}
                className={
                  tool === "eraser" ? "card-mark erasable" : "card-mark"
                }
                style={
                  { "--mark-color": segment.highlight.color } as CSSProperties
                }
              >
                {segment.text}
              </mark>
            ) : (
              segment.text
            )
          )}
    </span>
  );
}

// Turns the browser's current text selection into highlights, one per
// [data-mark-field] element the selection touches (a selection dragged from
// the question into the answer becomes two highlights). Offsets are counted
// in the element's own text, which is exactly the string that was passed to
// <MarkableText>, however many <mark> segments it is currently split into.
function selectionToHighlights(root: HTMLElement, color: string): Highlight[] {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return [];
  }
  const range = selection.getRangeAt(0);
  const found: Highlight[] = [];
  root.querySelectorAll<HTMLElement>("[data-mark-field]").forEach(element => {
    if (!range.intersectsNode(element)) return;
    const full = document.createRange();
    full.selectNodeContents(element);
    const clip = range.cloneRange();
    if (clip.compareBoundaryPoints(Range.START_TO_START, full) < 0) {
      clip.setStart(full.startContainer, full.startOffset);
    }
    if (clip.compareBoundaryPoints(Range.END_TO_END, full) > 0) {
      clip.setEnd(full.endContainer, full.endOffset);
    }
    const before = document.createRange();
    before.selectNodeContents(element);
    before.setEnd(clip.startContainer, clip.startOffset);
    const start = before.toString().length;
    const text = clip.toString();
    if (!text.trim()) return;
    // Don't paint the whitespace a drag selection tends to grab at its ends.
    const leading = text.length - text.trimStart().length;
    const trailing = text.length - text.trimEnd().length;
    found.push({
      id: newMarkId(),
      field: element.dataset.markField as MarkField,
      start: start + leading,
      end: start + text.length - trailing,
      color,
    });
  });
  return found;
}

// Loads this card's saved marks and saves every edit back, debounced. Edits
// are also flushed when the card is left (unmount) or the tab is hidden, so
// switching cards quickly never loses a highlight.
function useCardMarks(cardId: string) {
  const utils = trpc.useUtils();
  const query = trpc.cardMarks.get.useQuery(
    { cardId },
    // Long staleTime + setData on every edit keep the cache authoritative, so
    // coming back to a card doesn't refetch and briefly show an older copy
    // than the one we just saved.
    { staleTime: 5 * 60_000, refetchOnWindowFocus: false }
  );
  const [marks, setMarks] = useState<CardMarks>(
    () => query.data ?? emptyMarks()
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const marksRef = useRef(marks);
  const dirtyRef = useRef(false);
  const unsavedRef = useRef(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!query.data || dirtyRef.current) return;
    marksRef.current = query.data;
    setMarks(query.data);
  }, [query.data]);

  async function flush() {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    if (savingRef.current || !unsavedRef.current) return;
    savingRef.current = true;
    try {
      // Loops so an edit made while a save is in flight is sent right after
      // it, in order, instead of racing it.
      while (unsavedRef.current) {
        unsavedRef.current = false;
        if (mountedRef.current) setSaveState("saving");
        await utils.client.cardMarks.save.mutate({
          cardId,
          ...marksRef.current,
        });
      }
      if (mountedRef.current) setSaveState("saved");
    } catch {
      unsavedRef.current = true;
      if (mountedRef.current) setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  }
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  function update(change: (current: CardMarks) => CardMarks) {
    const next = change(marksRef.current);
    if (next === marksRef.current) return;
    dirtyRef.current = true;
    marksRef.current = next;
    setMarks(next);
    utils.cardMarks.get.setData({ cardId }, next);
    unsavedRef.current = true;
    setSaveState("saving");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
  }
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  });

  useEffect(() => {
    mountedRef.current = true;
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const onPageHide = () => void flushRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      mountedRef.current = false;
      void flushRef.current();
    };
  }, []);

  return {
    marks,
    update,
    updateRef,
    saveState,
    retrySave: () => void flush(),
    ready: query.isSuccess,
    loadFailed: query.isError,
    reload: () => void query.refetch(),
  };
}

function MarkingLayer({
  cardId,
  tool,
  onToolChange,
  highlightColor,
  onHighlightColorChange,
  penColor,
  onPenColorChange,
  children,
}: {
  cardId: string;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  penColor: string;
  onPenColorChange: (color: string) => void;
  children: ReactNode;
}) {
  const {
    marks,
    update,
    updateRef,
    saveState,
    retrySave,
    ready,
    loadFailed,
    reload,
  } = useCardMarks(cardId);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const draftRef = useRef<Stroke | null>(null);
  const erasingRef = useRef(false);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = surfaceRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  // تظليل: once a text selection is made, paint it and clear the selection.
  // Mouse/pen apply as soon as the button is released; touch selections are
  // adjusted with drag handles after the long-press, so those wait until the
  // selection has stopped changing.
  useEffect(() => {
    if (tool !== "highlight") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastPointerType = "mouse";
    const apply = () => {
      const root = surfaceRef.current;
      if (!root) return;
      const found = selectionToHighlights(root, highlightColor);
      if (!found.length) return;
      updateRef.current(current => {
        let highlights = current.highlights;
        for (const highlight of found) {
          if (highlights.length >= MAX_HIGHLIGHTS) break;
          highlights = addHighlight(highlights, highlight);
        }
        return { ...current, highlights };
      });
      window.getSelection()?.removeAllRanges();
    };
    const onPointerDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch") setTimeout(apply, 0);
    };
    const onSelectionChange = () => {
      if (lastPointerType !== "touch") return;
      clearTimeout(timer);
      timer = setTimeout(apply, 600);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [tool, highlightColor, updateRef]);

  function pointFromEvent(event: ReactPointerEvent): StrokePoint | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.max(0, (event.clientY - rect.top) / rect.width),
    ];
  }

  // ممحاة: removes the pen strokes under the pointer, and any highlight whose
  // text is under it (the canvas sits on top, so ask the document what is
  // beneath the pointer rather than relying on the <mark>'s own events).
  function eraseAt(event: ReactPointerEvent, point: StrokePoint) {
    const hitIds = new Set(
      document
        .elementsFromPoint(event.clientX, event.clientY)
        .map(element => (element as HTMLElement).dataset?.markId)
        .filter((id): id is string => !!id)
    );
    update(current => {
      const strokes = eraseStrokesAt(current.strokes, point, ERASER_RADIUS);
      const highlights = hitIds.size
        ? current.highlights.filter(h => !hitIds.has(h.id))
        : current.highlights;
      return strokes === current.strokes &&
        highlights.length === current.highlights.length
        ? current
        : { highlights, strokes };
    });
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // The canvas covers the whole card while pen/eraser is active, so let a
    // tap on "اظهر الإجابة" through instead of starting a stroke there.
    const reveal = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map(element => element.closest<HTMLElement>(".reveal-button"))
      .find(Boolean);
    if (reveal) {
      reveal.click();
      return;
    }
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "pen") {
      const stroke: Stroke = {
        id: newMarkId(),
        color: penColor,
        width: PEN_WIDTH,
        points: [point],
      };
      draftRef.current = stroke;
      setDraft(stroke);
    } else if (tool === "eraser") {
      erasingRef.current = true;
      eraseAt(event, point);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointFromEvent(event);
    if (!point) return;
    const current = draftRef.current;
    if (current) {
      if (current.points.length >= MAX_POINTS_PER_STROKE) return;
      const points = appendPoint(current.points, point);
      if (points === current.points) return;
      const next = { ...current, points };
      draftRef.current = next;
      setDraft(next);
    } else if (erasingRef.current) {
      eraseAt(event, point);
    }
  }

  function finishPointer() {
    erasingRef.current = false;
    const stroke = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!stroke) return;
    update(current =>
      current.strokes.length >= MAX_STROKES
        ? current
        : { ...current, strokes: [...current.strokes, stroke] }
    );
  }

  function clearAll() {
    if (!window.confirm("مسح كل التظليل والرسم من هذه البطاقة؟")) return;
    update(() => emptyMarks());
  }

  function chooseHighlightColor(color: string) {
    onHighlightColorChange(color);
    onToolChange("highlight");
  }

  const canvasActive = tool === "pen" || tool === "eraser";
  const swatches =
    tool === "pen"
      ? { colors: PEN_COLORS, value: penColor, onPick: onPenColorChange }
      : tool === "eraser"
        ? null
        : {
            colors: HIGHLIGHT_COLORS,
            value: highlightColor,
            onPick: chooseHighlightColor,
          };
  const tools: { tool: Tool; label: string; icon: typeof Eraser }[] = [
    { tool: "none", label: "تصفّح", icon: MousePointer2 },
    { tool: "highlight", label: "تظليل", icon: Highlighter },
    { tool: "pen", label: "قلم", icon: PenLine },
    { tool: "eraser", label: "ممحاة", icon: Eraser },
  ];

  return (
    <MarkContext.Provider value={{ highlights: marks.highlights, tool }}>
      <div className="marking-toolbar" role="toolbar" aria-label="أدوات التظليل">
        <div className="marking-tools">
          {tools.map(item => (
            <button
              key={item.tool}
              type="button"
              className="marking-tool"
              aria-pressed={tool === item.tool}
              disabled={!ready && item.tool !== "none"}
              onClick={() => onToolChange(item.tool)}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </div>
        {swatches && (
          <div className="marking-swatches" role="group" aria-label="الألوان">
            {swatches.colors.map(color => (
              <button
                key={color.value}
                type="button"
                className="marking-swatch"
                style={{ backgroundColor: color.value }}
                aria-label={color.label}
                title={color.label}
                aria-pressed={swatches.value === color.value}
                disabled={!ready}
                onClick={() => swatches.onPick(color.value)}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          className="marking-tool"
          disabled={isEmptyMarks(marks)}
          onClick={clearAll}
          title="مسح كل التظليل والرسم من هذه البطاقة"
        >
          <Trash2 size={15} />
          مسح الكل
        </button>
        <span
          className={
            saveState === "error" || loadFailed
              ? "marking-status error"
              : "marking-status"
          }
          aria-live="polite"
        >
          {loadFailed ? (
            <>
              <CircleAlert size={13} /> تعذّر تحميل تظليلك
              <button type="button" onClick={reload}>
                إعادة
              </button>
            </>
          ) : saveState === "saving" ? (
            <>
              <Loader2 size={13} className="spin" /> جارٍ الحفظ…
            </>
          ) : saveState === "saved" ? (
            <>
              <Check size={13} /> تم الحفظ
            </>
          ) : saveState === "error" ? (
            <>
              <CircleAlert size={13} /> تعذّر الحفظ
              <button type="button" onClick={retrySave}>
                إعادة
              </button>
            </>
          ) : null}
        </span>
      </div>
      {TOOL_HINTS[tool] && <p className="marking-hint">{TOOL_HINTS[tool]}</p>}
      <div ref={surfaceRef} className={`marking-surface tool-${tool}`}>
        {children}
        <svg
          ref={svgRef}
          className={
            canvasActive && ready ? "marking-canvas active" : "marking-canvas"
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          aria-hidden="true"
        >
          {[...marks.strokes, ...(draft ? [draft] : [])].map(stroke => (
            <path
              key={stroke.id}
              d={strokePath(stroke.points, width)}
              stroke={stroke.color}
              strokeWidth={stroke.width * width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.88}
            />
          ))}
        </svg>
      </div>
    </MarkContext.Provider>
  );
}

// The chosen tool and colours live here, above the per-card layer, so they
// carry over as the student moves from card to card; the layer itself is
// keyed by card so each card loads, edits and saves its own marks.
export function MarkingSurface({
  cardId,
  children,
}: {
  cardId: string;
  children: ReactNode;
}) {
  const [tool, setTool] = useState<Tool>("none");
  const [highlightColor, setHighlightColor] = useState<string>(
    HIGHLIGHT_COLORS[0].value
  );
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value);
  return (
    <MarkingLayer
      key={cardId}
      cardId={cardId}
      tool={tool}
      onToolChange={setTool}
      highlightColor={highlightColor}
      onHighlightColorChange={setHighlightColor}
      penColor={penColor}
      onPenColorChange={setPenColor}
    >
      {children}
    </MarkingLayer>
  );
}
