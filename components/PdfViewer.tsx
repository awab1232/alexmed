"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  CircleAlert,
  Eraser,
  Highlighter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import {
  appendPoint,
  eraseStrokesAt,
  newMarkId,
  strokePath,
  addPdfHighlight,
  emptyPageMarks,
  ERASER_RADIUS,
  HIGHLIGHT_COLORS,
  PEN_COLORS,
  PEN_WIDTH,
  type PdfHighlight,
  type PdfPageMarks,
  type Rect,
  type Stroke,
  type StrokePoint,
} from "@/lib/pdf-marks";

// Real client-side PDF.js viewer of the ORIGINAL uploaded file, now with a
// real تضليل/قلم/ممحاة layer on top of every page (see lib/pdf-marks.ts) —
// the كتبي counterpart of مِرآة's card marking (components/CardMarks.tsx).
//
// Rendering strategy: pages are laid out as placeholder blocks up front
// (their exact size becomes known once each page's own viewport is fetched,
// lazily, right before it's shown) and only rendered to a <canvas> once an
// IntersectionObserver says they're near the viewport — a book can be up to
// 250MB/hundreds of pages, so rendering every page eagerly would be real
// jank, not a simplification.
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.15;
const RENDER_TIMEOUT_MS = 20000;
const SAVE_DELAY_MS = 700;

type PageState = {
  proxy: import("pdfjs-dist").PDFPageProxy | null;
  rendered: boolean;
  rendering: boolean;
};

type SearchMatch = { page: number; snippet: string };
type Tool = "none" | "highlight" | "pen" | "eraser";
type SaveState = "idle" | "saving" | "saved" | "error";

const TOOL_HINTS: Record<Tool, string> = {
  none: "",
  highlight: "حدّد أي نص على الصفحة لتظليله باللون المختار.",
  pen: "ارسم بحرّية فوق الصفحة لتحديد النقاط المهمة.",
  eraser: "مرّر على التظليل أو الرسم لمسحه.",
};

// Turns a browser selection's client rect into a Rect normalised by the
// page's own rendered width — consistent with a pen stroke's own [x, y]
// normalisation (lib/pdf-marks.ts, reused from card marks).
function rectFromClientRect(clientRect: DOMRect, pageRect: DOMRect): Rect {
  return {
    x: (clientRect.left - pageRect.left) / pageRect.width,
    y: (clientRect.top - pageRect.top) / pageRect.width,
    width: clientRect.width / pageRect.width,
    height: clientRect.height / pageRect.width,
  };
}

// One page's pen/eraser overlay + rendered highlights. Pointer handling here
// mirrors components/CardMarks.tsx's MarkingLayer almost exactly — the only
// difference is the surface is a PDF page (normalised by the page's own
// rendered width) instead of a flashcard.
function PageMarkOverlay({
  tool,
  penColor,
  marks,
  onUpdate,
}: {
  pageNumber: number;
  tool: Tool;
  penColor: string;
  marks: PdfPageMarks;
  onUpdate: (change: (current: PdfPageMarks) => PdfPageMarks) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const draftRef = useRef<Stroke | null>(null);
  const erasingRef = useRef(false);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  function pointFromEvent(event: ReactPointerEvent): StrokePoint | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.max(0, (event.clientY - rect.top) / rect.width),
    ];
  }

  function eraseAt(event: ReactPointerEvent, point: StrokePoint) {
    const hitIds = new Set(
      document
        .elementsFromPoint(event.clientX, event.clientY)
        .map(element => (element as HTMLElement).dataset?.markId)
        .filter((id): id is string => !!id)
    );
    onUpdate(current => {
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
    if (tool !== "pen" && tool !== "eraser") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "eraser") {
      erasingRef.current = true;
      eraseAt(event, point);
      return;
    }
    const stroke: Stroke = {
      id: newMarkId(),
      color: penColor,
      width: PEN_WIDTH,
      points: [point],
    };
    draftRef.current = stroke;
    setDraft(stroke);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointFromEvent(event);
    if (!point) return;
    if (erasingRef.current) {
      eraseAt(event, point);
      return;
    }
    if (!draftRef.current) return;
    const next = {
      ...draftRef.current,
      points: appendPoint(draftRef.current.points, point),
    };
    draftRef.current = next;
    setDraft(next);
  }

  function handlePointerUp() {
    erasingRef.current = false;
    const stroke = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!stroke || stroke.points.length === 0) return;
    onUpdate(current => ({
      ...current,
      strokes: [...current.strokes, stroke],
    }));
  }

  const interactive = tool === "pen" || tool === "eraser";
  const allStrokes = draft ? [...marks.strokes, draft] : marks.strokes;

  return (
    <div
      ref={rootRef}
      className={
        interactive ? "pdf-mark-overlay is-active" : "pdf-mark-overlay"
      }
    >
      {marks.highlights.map(highlight =>
        highlight.rects.map((rect, index) => (
          <div
            key={`${highlight.id}-${index}`}
            data-mark-id={highlight.id}
            className={tool === "eraser" ? "pdf-mark erasable" : "pdf-mark"}
            style={{
              left: `${rect.x * width}px`,
              top: `${rect.y * width}px`,
              width: `${rect.width * width}px`,
              height: `${rect.height * width}px`,
              background: highlight.color,
            }}
          />
        ))
      )}
      <svg
        ref={svgRef}
        className="pdf-mark-svg"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {allStrokes.map(stroke => (
          <path
            key={stroke.id}
            d={strokePath(stroke.points, width)}
            stroke={stroke.color}
            strokeWidth={Math.max(1, stroke.width * width)}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}

export default function PdfViewer({
  bookId,
  src,
  fileName,
  backHref,
}: {
  bookId: string;
  src: string;
  fileName?: string;
  backHref: string;
}) {
  const [pdfjs, setPdfjs] = useState<typeof import("pdfjs-dist") | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1);
  const [fitWidthScale, setFitWidthScale] = useState(1);
  // Tapping a page (in browse mode) hides the top/bottom bars so the page
  // gets the whole screen, like the iOS PDF viewer; tapping again brings
  // them back.
  const [chromeHidden, setChromeHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string | null>(
    null
  );
  // Keyed by page number → a real, human-readable diagnostic string (error
  // name/message + how long it took to fail) instead of just a boolean —
  // three earlier blind fixes for "every page fails" each turned out wrong,
  // so this exists to stop guessing and show the actual failure reason.
  const [pageErrors, setPageErrors] = useState<Map<number, string>>(new Map());

  // تضليل/قلم/ممحاة toolbar state.
  const [tool, setTool] = useState<Tool>("none");
  const [highlightColor, setHighlightColor] = useState<string>(
    HIGHLIGHT_COLORS[0].value
  );
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageStatesRef = useRef<Map<number, PageState>>(new Map());
  const canvasElsRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const textLayerElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const textLayerInstancesRef = useRef<
    Map<number, InstanceType<typeof import("pdfjs-dist").TextLayer>>
  >(new Map());
  const wrapperElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasksRef = useRef<Map<number, RenderTask>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── تضليل/قلم persistence — loads every page's marks in one call and
  // saves each edited page back, debounced per page (a student can edit more
  // than one page within the same debounce window while scrolling).
  const utils = trpc.useUtils();
  const marksQuery = trpc.bookPageMarks.list.useQuery(
    { bookId },
    { staleTime: 5 * 60_000, refetchOnWindowFocus: false }
  );
  const [marksByPage, setMarksByPage] = useState<Map<number, PdfPageMarks>>(
    new Map()
  );
  const marksRef = useRef(marksByPage);
  const dirtyPagesRef = useRef<Set<number>>(new Set());
  const unsavedPagesRef = useRef<Set<number>>(new Set());
  const savingPagesRef = useRef<Set<number>>(new Set());
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    if (!marksQuery.data) return;
    marksRef.current = marksQuery.data;
    setMarksByPage(marksQuery.data);
  }, [marksQuery.data]);

  async function flushPage(pageNumber: number) {
    clearTimeout(timersRef.current.get(pageNumber));
    timersRef.current.delete(pageNumber);
    if (
      savingPagesRef.current.has(pageNumber) ||
      !unsavedPagesRef.current.has(pageNumber)
    ) {
      return;
    }
    savingPagesRef.current.add(pageNumber);
    try {
      while (unsavedPagesRef.current.has(pageNumber)) {
        unsavedPagesRef.current.delete(pageNumber);
        setSaveState("saving");
        const marks = marksRef.current.get(pageNumber) ?? emptyPageMarks();
        await utils.client.bookPageMarks.save.mutate({
          bookId,
          pageNumber,
          ...marks,
        });
      }
      setSaveState("saved");
    } catch {
      unsavedPagesRef.current.add(pageNumber);
      setSaveState("error");
    } finally {
      savingPagesRef.current.delete(pageNumber);
    }
  }
  const flushPageRef = useRef(flushPage);
  useEffect(() => {
    flushPageRef.current = flushPage;
  });

  function flushAllDirty() {
    for (const pageNumber of Array.from(unsavedPagesRef.current)) {
      void flushPageRef.current(pageNumber);
    }
  }

  function updatePageMarks(
    pageNumber: number,
    change: (current: PdfPageMarks) => PdfPageMarks
  ) {
    const current = marksRef.current.get(pageNumber) ?? emptyPageMarks();
    const next = change(current);
    if (next === current) return;
    const nextMap = new Map(marksRef.current);
    nextMap.set(pageNumber, next);
    marksRef.current = nextMap;
    setMarksByPage(nextMap);
    dirtyPagesRef.current.add(pageNumber);
    unsavedPagesRef.current.add(pageNumber);
    setSaveState("saving");
    clearTimeout(timersRef.current.get(pageNumber));
    timersRef.current.set(
      pageNumber,
      setTimeout(() => void flushPageRef.current(pageNumber), SAVE_DELAY_MS)
    );
  }
  const updateRef = useRef(updatePageMarks);
  useEffect(() => {
    updateRef.current = updatePageMarks;
  });

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAllDirty();
    };
    const onPageHide = () => flushAllDirty();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flushAllDirty();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تضليل capture: a finished text selection becomes one highlight per page
  // its rects fall on (a drag that crosses two pages splits into two
  // highlights) — same pointerup(mouse)/selectionchange(touch, debounced)
  // detection as CardMarks.tsx's selectionToHighlights.
  useEffect(() => {
    if (tool !== "highlight") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastPointerType = "mouse";
    const apply = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }
      const range = selection.getRangeAt(0);
      const clientRects = Array.from(range.getClientRects());
      if (!clientRects.length) return;

      const byPage = new Map<number, DOMRect[]>();
      for (const clientRect of clientRects) {
        if (clientRect.width <= 0 || clientRect.height <= 0) continue;
        const midY = clientRect.top + clientRect.height / 2;
        const midX = clientRect.left + clientRect.width / 2;
        for (const [pageNumber, el] of textLayerElsRef.current) {
          const pageRect = el.getBoundingClientRect();
          if (
            midY >= pageRect.top &&
            midY <= pageRect.bottom &&
            midX >= pageRect.left &&
            midX <= pageRect.right
          ) {
            const list = byPage.get(pageNumber) ?? [];
            list.push(clientRect);
            byPage.set(pageNumber, list);
            break;
          }
        }
      }

      for (const [pageNumber, rects] of byPage) {
        const pageEl = textLayerElsRef.current.get(pageNumber);
        if (!pageEl) continue;
        const pageRect = pageEl.getBoundingClientRect();
        const highlight: PdfHighlight = {
          id: newMarkId(),
          color: highlightColor,
          rects: rects.map(r => rectFromClientRect(r, pageRect)),
        };
        updateRef.current(pageNumber, current => ({
          ...current,
          highlights: addPdfHighlight(current.highlights, highlight),
        }));
      }
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
  }, [tool, highlightColor]);

  // pdfjs-dist touches DOM/worker APIs that don't exist during SSR — loaded
  // once, client-side only, worker wired to the static copy in public/
  // (see public/pdf.worker.legacy.min.mjs) rather than a webpack asset URL,
  // since that's the one wiring approach that behaves the same across bundlers.
  // The *legacy* build is required: the modern one calls
  // Map.prototype.getOrInsertComputed, which iOS Safari doesn't have, so every
  // page failed there. The legacy build (main + worker) bundles the polyfills.
  // Refresh the worker copy from
  // node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs on every upgrade.
  useEffect(() => {
    let cancelled = false;
    import("pdfjs-dist/legacy/build/pdf.mjs").then(mod => {
      if (cancelled) return;
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.legacy.min.mjs";
      setPdfjs(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pdfjs) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setDoc(null);
    setNumPages(0);
    setPageErrors(new Map());
    pageStatesRef.current.clear();
    canvasElsRef.current.clear();
    textLayerElsRef.current.clear();
    wrapperElsRef.current.clear();

    // standardFontDataUrl/cMapUrl are required for correct text extraction
    // and rendering on real-world PDFs that don't embed their own font —
    // without them, pdf.js silently mis-renders/truncates text using
    // non-embedded standard fonts (verified against a real test file).
    //
    // disableStream/disableRange/disableAutoFetch: `src` is our own
    // same-origin /api/files/[key] route, which 307-redirects to a signed,
    // cross-origin storage URL — pdf.js's default network layer follows that
    // redirect and keeps issuing progressive Range requests against the
    // (now cross-origin) target. A presigned storage URL frequently doesn't
    // answer those Range requests with the CORS headers browsers require,
    // so the initial small fetch (enough to read the page count) succeeds
    // while every later per-page byte-range fetch a canvas render needs
    // silently fails — the exact "page count/thumbnails show, every canvas
    // stays blank white, no error anywhere" symptom this was built to fix.
    // Disabling streaming makes pdf.js fetch the whole file once up front
    // instead, which works the same as any other cross-origin resource.
    const loadingTask = pdfjs.getDocument({
      url: src,
      standardFontDataUrl: "/standard_fonts/",
      cMapUrl: "/cmaps/",
      cMapPacked: true,
      disableStream: true,
      disableRange: true,
      disableAutoFetch: true,
    });
    loadingTask.promise.then(
      pdf => {
        if (cancelled) return;
        setDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setPageInput("1");
        setLoading(false);
      },
      loadError => {
        if (cancelled) return;
        const detail =
          loadError instanceof Error
            ? `${loadError.name}: ${loadError.message}`
            : String(loadError);
        setError(
          `تعذر تحميل ملف PDF. تحقق من اتصالك وحاول مرة أخرى. (${detail})`
        );
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfjs, src]);

  // "Fit width" base scale — recomputed from the first page whenever the
  // container resizes, so mobile/desktop both get a readable default.
  useEffect(() => {
    if (!doc || !containerRef.current) return;
    let cancelled = false;
    const el = containerRef.current;

    async function computeFitWidth() {
      const page = await doc!.getPage(1);
      if (cancelled) return;
      const unscaledWidth = page.getViewport({ scale: 1 }).width;
      // Edge-to-edge on phones (only the pages' own 6px side padding), capped
      // on wide screens so a desktop page isn't absurdly large at 100%.
      const available = Math.min(el.clientWidth - 12, 900);
      const next = Math.max(0.4, available / unscaledWidth);
      setFitWidthScale(next);
      setScale(current => (current === 1 ? next : current));
    }
    computeFitWidth();

    const resizeObserver = new ResizeObserver(() => computeFitWidth());
    resizeObserver.observe(el);
    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [doc]);

  const renderPage = useCallback(
    async (pageNumber: number, renderScale: number) => {
      if (!doc || !pdfjs) return;
      const canvas = canvasElsRef.current.get(pageNumber);
      if (!canvas) return;

      let state = pageStatesRef.current.get(pageNumber);
      if (!state) {
        state = { proxy: null, rendered: false, rendering: false };
        pageStatesRef.current.set(pageNumber, state);
      }
      if (state.rendering) return;
      state.rendering = true;
      const startedAt = Date.now();

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const page = state.proxy ?? (await doc.getPage(pageNumber));
        state.proxy = page;

        renderTasksRef.current.get(pageNumber)?.cancel();
        textLayerInstancesRef.current.get(pageNumber)?.cancel();

        const devicePixelRatio =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: renderScale });
        canvas.width = Math.floor(viewport.width * devicePixelRatio);
        canvas.height = Math.floor(viewport.height * devicePixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

        // pdfjs-dist 6.x renders from `canvas` alone (it derives its own 2D
        // context internally — HTMLCanvasElement.getContext("2d") always
        // returns the same singleton context, so our setTransform above
        // still applies to whatever pdf.js renders into). `canvasContext` is
        // now only a deprecated back-compat param, and its own type says the
        // canvas must be null when it's used — passing both together (an
        // earlier version of this code did) is invalid.
        const task = page.render({ viewport, canvas });
        renderTasksRef.current.set(pageNumber, task);

        // A render that never settles (a stalled cross-origin fetch, a
        // worker that silently dropped the request) used to leave this page
        // blank forever with `rendering` stuck true, since neither the catch
        // nor the finally below ever ran — this bounds it so a genuinely
        // stuck page becomes a visible, retryable failure instead.
        await Promise.race([
          task.promise,
          new Promise<never>((_resolve, reject) => {
            timeoutId = setTimeout(() => {
              task.cancel();
              reject(new Error("RenderTimeout"));
            }, RENDER_TIMEOUT_MS);
          }),
        ]);
        state.rendered = true;
        setPageErrors(prev => {
          if (!prev.has(pageNumber)) return prev;
          const next = new Map(prev);
          next.delete(pageNumber);
          return next;
        });

        // Text layer — real, positioned DOM spans over the canvas, giving
        // native selection (which تضليل capture above reads) and copy/
        // search for free. `--total-scale-factor` isn't provided by any
        // ancestor here (we don't use pdf.js's own PDFPageView chrome), so
        // it's set to 1: our viewport already encodes the real render scale
        // directly in CSS-pixel units, same as the canvas above.
        //
        // Deliberately started only AFTER the canvas render above has fully
        // settled, not concurrently with it: this same `page` proxy talks to
        // the pdf.js worker over postMessage, and firing streamTextContent()
        // and render() at the same time on one page was the actual cause of
        // every page hanging until the timeout above — canvas rendering
        // genuinely never resolved while a concurrent text-content request
        // was in flight on the same page. Sequencing them fixes that, and
        // costs nothing visible (canvas paints first regardless; the text
        // layer only affects selection, not what's on screen).
        //
        // Also isolated in its own try/catch: text layer is secondary
        // (selection/highlight support) and must never fail the page's
        // actual visible content — a text-layer problem should lose only
        // text selection, never turn an already-successful render into
        // "تعذر عرض هذه الصفحة".
        try {
          const textLayerEl = textLayerElsRef.current.get(pageNumber);
          if (textLayerEl) {
            textLayerEl.replaceChildren();
            textLayerEl.style.setProperty("--total-scale-factor", "1");
            textLayerEl.style.width = `${Math.floor(viewport.width)}px`;
            textLayerEl.style.height = `${Math.floor(viewport.height)}px`;
            const textLayer = new pdfjs.TextLayer({
              textContentSource: page.streamTextContent(),
              container: textLayerEl,
              viewport,
            });
            textLayerInstancesRef.current.set(pageNumber, textLayer);
            textLayer.render().catch(() => {
              // A cancelled text-layer render throws too — harmless.
            });
          }
        } catch {
          // Text layer failed to even start — the canvas above already
          // rendered successfully regardless.
        }
      } catch (renderError) {
        // A render superseded by a newer one (scale changed mid-flight, or
        // this same page re-requested) throws "RenderingCancelledException"
        // — expected, not a real failure, so it never marks the page failed.
        const isCancelled =
          renderError instanceof Error &&
          renderError.name === "RenderingCancelledException";
        if (!isCancelled) {
          state.rendered = false;
          const elapsedMs = Date.now() - startedAt;
          const detail =
            renderError instanceof Error
              ? `${renderError.name}: ${renderError.message}`
              : String(renderError);
          setPageErrors(prev => {
            const next = new Map(prev);
            next.set(pageNumber, `${detail} — بعد ${elapsedMs}ms`);
            return next;
          });
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        state.rendering = false;
      }
    },
    [doc, pdfjs]
  );

  // Re-render every page that's already on screen whenever the zoom level
  // changes (pages never observed yet just pick up the new scale on first
  // render instead).
  useEffect(() => {
    if (!doc) return;
    for (const [pageNumber, state] of pageStatesRef.current.entries()) {
      if (state.rendered) renderPage(pageNumber, scale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, doc]);

  const setWrapperRef = useCallback(
    (pageNumber: number) => (el: HTMLDivElement | null) => {
      if (!el) {
        wrapperElsRef.current.delete(pageNumber);
        return;
      }
      wrapperElsRef.current.set(pageNumber, el);
      observerRef.current?.observe(el);
    },
    []
  );

  const setCanvasRef = useCallback(
    (pageNumber: number) => (el: HTMLCanvasElement | null) => {
      if (!el) {
        canvasElsRef.current.delete(pageNumber);
        return;
      }
      canvasElsRef.current.set(pageNumber, el);
    },
    []
  );

  const setTextLayerRef = useCallback(
    (pageNumber: number) => (el: HTMLDivElement | null) => {
      if (!el) {
        textLayerElsRef.current.delete(pageNumber);
        return;
      }
      textLayerElsRef.current.set(pageNumber, el);
    },
    []
  );

  useEffect(() => {
    if (!doc || !scrollRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        let bestPage = currentPage;
        let bestRatio = 0;
        for (const entry of entries) {
          const pageNumber = Number(
            (entry.target as HTMLElement).dataset.pageNumber
          );
          if (entry.isIntersecting) {
            renderPage(pageNumber, scale);
            if (entry.intersectionRatio > bestRatio) {
              bestRatio = entry.intersectionRatio;
              bestPage = pageNumber;
            }
          }
        }
        if (bestRatio > 0) {
          setCurrentPage(bestPage);
          setPageInput(String(bestPage));
        }
      },
      {
        root: scrollRef.current,
        rootMargin: "600px 0px 600px 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    observerRef.current = observer;
    wrapperElsRef.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, scale]);

  // Fallback so the viewer never depends solely on the IntersectionObserver
  // above for its very first visible content: if the scroll container
  // measures a collapsed/zero height at the moment the observer is created
  // (a real layout race), no page ever reports as intersecting and every
  // canvas stays blank forever with no error shown. Rendering page 1
  // unconditionally here costs nothing extra once real scrolling does kick
  // in (renderPage no-ops while already rendering/rendered).
  useEffect(() => {
    if (!doc || numPages < 1) return;
    renderPage(1, scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, numPages]);

  function scrollToPage(pageNumber: number) {
    const el = wrapperElsRef.current.get(pageNumber);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToPageInput() {
    const n = Number(pageInput);
    if (!Number.isInteger(n) || n < 1 || n > numPages) {
      setPageInput(String(currentPage));
      return;
    }
    scrollToPage(n);
  }

  function zoomBy(delta: number) {
    setScale(current =>
      Math.min(MAX_SCALE, Math.max(MIN_SCALE, current + delta))
    );
  }

  async function runSearch() {
    const query = searchQuery.trim().toLocaleLowerCase("ar");
    if (!doc || !query) {
      setSearchMatches([]);
      return;
    }
    setSearching(true);
    const matches: SearchMatch[] = [];
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      try {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map(item => ("str" in item ? item.str : ""))
          .join(" ");
        const lower = text.toLocaleLowerCase("ar");
        const at = lower.indexOf(query);
        if (at !== -1) {
          const start = Math.max(0, at - 30);
          const snippet =
            (start > 0 ? "…" : "") +
            text.slice(start, at + query.length + 30) +
            "…";
          matches.push({ page: pageNumber, snippet });
        }
      } catch {
        // A single page's text extraction failing shouldn't abort the whole
        // search — just skip it, same as any other page-level failure mode
        // elsewhere in this codebase.
      }
    }
    setSearchMatches(matches);
    setSearchMatchIndex(0);
    setSearching(false);
    setLastSearchedQuery(searchQuery.trim());
    if (matches.length) scrollToPage(matches[0].page);
  }

  function goToMatch(direction: number) {
    if (!searchMatches.length) return;
    const next =
      (searchMatchIndex + direction + searchMatches.length) %
      searchMatches.length;
    setSearchMatchIndex(next);
    scrollToPage(searchMatches[next].page);
  }

  // The Fullscreen API doesn't exist for elements on iPhone Safari, so the
  // reader is full-screen by layout instead (a fixed full-viewport shell, see
  // .pdf-reader-page) and "more room" means hiding the bars on tap.
  function handlePagesClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (tool !== "none") return;
    if ((event.target as HTMLElement).closest("button, a, input")) return;
    // A tap that ends a text selection shouldn't also toggle the bars.
    if (window.getSelection()?.toString()) return;
    setChromeHidden(hidden => !hidden);
  }

  const zoomPercent = useMemo(
    () => Math.round((scale / fitWidthScale) * 100),
    [scale, fitWidthScale]
  );

  return (
    <div
      ref={containerRef}
      className={chromeHidden ? "pdf-viewer chrome-hidden" : "pdf-viewer"}
    >
      {/* Top bar: back, file name, page counter, search — floats over the
          pages (like the iOS PDF viewer) and slides away on tap. */}
      <div className="pdf-viewer-top">
        <div className="pdf-viewer-topbar">
          <Link href={backHref} className="pdf-viewer-back">
            <ChevronRight size={22} />
            <span>رجوع</span>
          </Link>
          <span className="pdf-viewer-title" title={fileName}>
            {fileName}
          </span>
          {/* dir=ltr so it reads "5 / 26", not the RTL-flipped "26 / 5". */}
          <span className="pdf-viewer-page-indicator" dir="ltr">
            <input
              value={pageInput}
              onChange={event => setPageInput(event.target.value)}
              onBlur={goToPageInput}
              onKeyDown={event => {
                if (event.key === "Enter") goToPageInput();
              }}
              inputMode="numeric"
              aria-label="رقم الصفحة"
            />
            <span>/ {numPages || "—"}</span>
          </span>
          <button
            type="button"
            className={searchOpen ? "pdf-viewer-btn active" : "pdf-viewer-btn"}
            onClick={() => setSearchOpen(open => !open)}
            aria-label="البحث في الملف"
            aria-pressed={searchOpen}
          >
            <Search size={18} />
          </button>
        </div>

        {searchOpen && (
          <div className="pdf-viewer-search">
            <form
              onSubmit={event => {
                event.preventDefault();
                runSearch();
              }}
            >
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="ابحث داخل الملف..."
                autoFocus
              />
              <button type="submit" disabled={searching}>
                {searching ? <Loader2 size={14} className="spin" /> : "بحث"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchMatches([]);
                  setSearchQuery("");
                  setLastSearchedQuery(null);
                }}
                aria-label="إغلاق البحث"
              >
                <X size={14} />
              </button>
            </form>
            {!searching &&
              lastSearchedQuery === searchQuery.trim() &&
              !!lastSearchedQuery && (
                <div className="pdf-viewer-search-results">
                  {searchMatches.length ? (
                    <>
                      <div className="pdf-viewer-search-nav">
                        <button type="button" onClick={() => goToMatch(-1)}>
                          <ChevronRight size={14} />
                        </button>
                        <span>
                          {searchMatchIndex + 1} / {searchMatches.length}
                        </span>
                        <button type="button" onClick={() => goToMatch(1)}>
                          <ChevronLeft size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="pdf-viewer-search-match"
                        onClick={() =>
                          scrollToPage(searchMatches[searchMatchIndex].page)
                        }
                      >
                        <strong>
                          صفحة {searchMatches[searchMatchIndex].page}
                        </strong>
                        <span>{searchMatches[searchMatchIndex].snippet}</span>
                      </button>
                    </>
                  ) : (
                    <p>لا نتائج مطابقة.</p>
                  )}
                </div>
              )}
          </div>
        )}
      </div>

      {error ? (
        <div className="empty-state">
          <CircleAlert size={28} />
          <h3>{error}</h3>
        </div>
      ) : loading ? (
        <div className="empty-state">
          <Loader2 size={28} className="spin" />
          <h3>جاري تحميل {fileName || "الملف"}...</h3>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="pdf-viewer-pages"
          onClick={handlePagesClick}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNumber => (
            <div
              key={pageNumber}
              ref={setWrapperRef(pageNumber)}
              data-page-number={pageNumber}
              className="pdf-viewer-page"
            >
              <canvas ref={setCanvasRef(pageNumber)} />
              <div ref={setTextLayerRef(pageNumber)} className="textLayer" />
              <PageMarkOverlay
                pageNumber={pageNumber}
                tool={tool}
                penColor={penColor}
                marks={marksByPage.get(pageNumber) ?? emptyPageMarks()}
                onUpdate={change => updateRef.current(pageNumber, change)}
              />
              {pageErrors.has(pageNumber) && (
                <div className="pdf-viewer-page-error">
                  <CircleAlert size={18} />
                  <span>تعذر عرض هذه الصفحة</span>
                  {/* Real diagnostic text (error name/message + elapsed
                      time) instead of just a generic message — three blind
                      guesses in a row at the cause were wrong, this is here
                      so the next report carries actual evidence. */}
                  <small className="pdf-viewer-page-error-detail">
                    {pageErrors.get(pageNumber)}
                  </small>
                  <button
                    type="button"
                    onClick={() => renderPage(pageNumber, scale)}
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar: marking tools + zoom, iOS-style at the thumb's reach. */}
      <div className="pdf-viewer-bottom">
        {tool !== "none" && (
          <div className="pdf-viewer-tool-options">
            {TOOL_HINTS[tool] && (
              <p className="pdf-mark-hint">{TOOL_HINTS[tool]}</p>
            )}
            {tool === "highlight" && (
              <span className="pdf-mark-colors">
                {HIGHLIGHT_COLORS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      highlightColor === option.value
                        ? "pdf-mark-color selected"
                        : "pdf-mark-color"
                    }
                    style={{ background: option.value }}
                    aria-label={option.label}
                    onClick={() => setHighlightColor(option.value)}
                  />
                ))}
              </span>
            )}
            {tool === "pen" && (
              <span className="pdf-mark-colors">
                {PEN_COLORS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      penColor === option.value
                        ? "pdf-mark-color selected"
                        : "pdf-mark-color"
                    }
                    style={{ background: option.value }}
                    aria-label={option.label}
                    onClick={() => setPenColor(option.value)}
                  />
                ))}
              </span>
            )}
          </div>
        )}
        <div className="pdf-viewer-bottombar">
          <div className="pdf-viewer-toolbar-group">
            <button
              type="button"
              className={
                tool === "none" ? "pdf-viewer-btn active" : "pdf-viewer-btn"
              }
              onClick={() => setTool("none")}
              aria-label="تصفّح"
              aria-pressed={tool === "none"}
            >
              <MousePointer2 size={18} />
            </button>
            <button
              type="button"
              className={
                tool === "highlight"
                  ? "pdf-viewer-btn active"
                  : "pdf-viewer-btn"
              }
              onClick={() =>
                setTool(tool === "highlight" ? "none" : "highlight")
              }
              aria-label="تضليل"
              aria-pressed={tool === "highlight"}
            >
              <Highlighter size={18} />
            </button>
            <button
              type="button"
              className={
                tool === "pen" ? "pdf-viewer-btn active" : "pdf-viewer-btn"
              }
              onClick={() => setTool(tool === "pen" ? "none" : "pen")}
              aria-label="قلم"
              aria-pressed={tool === "pen"}
            >
              <PenLine size={18} />
            </button>
            <button
              type="button"
              className={
                tool === "eraser" ? "pdf-viewer-btn active" : "pdf-viewer-btn"
              }
              onClick={() => setTool(tool === "eraser" ? "none" : "eraser")}
              aria-label="ممحاة"
              aria-pressed={tool === "eraser"}
            >
              <Eraser size={18} />
            </button>
            {saveState !== "idle" && (
              <span className="pdf-mark-save-state">
                {saveState === "saving" && (
                  <Loader2 size={13} className="spin" />
                )}
                {saveState === "saved" && <Check size={13} />}
                {saveState === "error" && <CircleAlert size={13} />}
              </span>
            )}
          </div>
          <div className="pdf-viewer-toolbar-group">
            <button
              type="button"
              className="pdf-viewer-btn"
              onClick={() => zoomBy(-SCALE_STEP)}
              aria-label="تصغير"
            >
              <Minus size={18} />
            </button>
            <span className="pdf-viewer-zoom-indicator">{zoomPercent}%</span>
            <button
              type="button"
              className="pdf-viewer-btn"
              onClick={() => zoomBy(SCALE_STEP)}
              aria-label="تكبير"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
