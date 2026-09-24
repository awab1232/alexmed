// 🔥 Exam Focus — card categories and client-side navigation helpers. Pure
// and dependency-free so both the server pipeline (lib/exam-focus.ts) and
// the swipe UI (app/books/[bookId]/exam-focus) import the same definitions.

export const EXAM_FOCUS_CATEGORIES = [
  "emergency",
  "must_know",
  "high_yield",
  "exam_trap",
  "numbers",
  "classification",
  "comparison",
  "treatment",
  "drug_dose",
  "contraindication",
  "indication",
  "clinical_clue",
  "investigation",
  "imaging",
  "mechanism",
  "pathophysiology",
  "prognosis",
  "definition",
  "association",
] as const;

export type ExamFocusCategory = (typeof EXAM_FOCUS_CATEGORIES)[number];

// Emoji is decoration only — every badge also carries a text label (and
// the emoji is aria-hidden in the UI), so meaning never relies on it.
// `priority` orders cards inside one part of the file (lower first).
export const EXAM_FOCUS_CATEGORY_INFO: Record<
  ExamFocusCategory,
  { emoji: string; label: string; labelAr: string; priority: number }
> = {
  emergency: { emoji: "🚨", label: "Emergency", labelAr: "طوارئ", priority: 0 },
  must_know: {
    emoji: "🔥",
    label: "Must Know",
    labelAr: "لازم تعرفها",
    priority: 1,
  },
  high_yield: {
    emoji: "⭐",
    label: "High Yield",
    labelAr: "مهمة جدًا",
    priority: 2,
  },
  exam_trap: {
    emoji: "⚠️",
    label: "Exam Trap",
    labelAr: "فخ امتحان",
    priority: 3,
  },
  numbers: {
    emoji: "🔢",
    label: "Numbers",
    labelAr: "أرقام وحدود",
    priority: 4,
  },
  classification: {
    emoji: "📊",
    label: "Classification",
    labelAr: "تصنيف",
    priority: 5,
  },
  comparison: {
    emoji: "⚖️",
    label: "Comparison",
    labelAr: "مقارنة",
    priority: 6,
  },
  treatment: { emoji: "💊", label: "Treatment", labelAr: "علاج", priority: 7 },
  drug_dose: {
    emoji: "💉",
    label: "Drug / Dose",
    labelAr: "دواء وجرعة",
    priority: 8,
  },
  contraindication: {
    emoji: "❌",
    label: "Contraindication",
    labelAr: "مانع استعمال",
    priority: 9,
  },
  indication: {
    emoji: "✅",
    label: "Indication",
    labelAr: "دواعي الاستعمال",
    priority: 10,
  },
  clinical_clue: {
    emoji: "🩺",
    label: "Clinical Clue",
    labelAr: "دليل سريري",
    priority: 11,
  },
  investigation: {
    emoji: "🧪",
    label: "Investigation",
    labelAr: "فحوصات",
    priority: 12,
  },
  imaging: { emoji: "🩻", label: "Imaging", labelAr: "تصوير", priority: 13 },
  mechanism: {
    emoji: "🧠",
    label: "Mechanism",
    labelAr: "آلية",
    priority: 14,
  },
  pathophysiology: {
    emoji: "🧬",
    label: "Pathophysiology",
    labelAr: "فيزيولوجيا مرضية",
    priority: 15,
  },
  prognosis: {
    emoji: "📈",
    label: "Prognosis",
    labelAr: "إنذار",
    priority: 16,
  },
  definition: {
    emoji: "📌",
    label: "Definition",
    labelAr: "تعريف",
    priority: 17,
  },
  association: {
    emoji: "🔗",
    label: "Association",
    labelAr: "ارتباط",
    priority: 18,
  },
};

export function isExamFocusCategory(
  value: unknown
): value is ExamFocusCategory {
  return (
    typeof value === "string" &&
    (EXAM_FOCUS_CATEGORIES as readonly string[]).includes(value)
  );
}

export function categoryInfo(category: string) {
  return isExamFocusCategory(category)
    ? EXAM_FOCUS_CATEGORY_INFO[category]
    : EXAM_FOCUS_CATEGORY_INFO.high_yield;
}

// Filter chips in priority order — only categories actually present in the
// deck are returned, so the UI never shows an empty filter.
export function visibleCategoryFilters(
  counts: Record<string, number>
): { category: ExamFocusCategory; count: number }[] {
  return [...EXAM_FOCUS_CATEGORIES]
    .sort(
      (a, b) =>
        EXAM_FOCUS_CATEGORY_INFO[a].priority -
        EXAM_FOCUS_CATEGORY_INFO[b].priority
    )
    .filter(category => (counts[category] ?? 0) > 0)
    .map(category => ({ category, count: counts[category] }));
}

// ── Swipe navigation (pure, unit-tested) ────────────────────────────────
export const SWIPE_THRESHOLD_PX = 70;

// Dragging the card LEFT goes to the next card, RIGHT to the previous one.
// A mostly-vertical drag is a scroll of a long card, never a swipe.
export function swipeDirection(dx: number, dy = 0): "next" | "previous" | null {
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dy) > Math.abs(dx)) {
    return null;
  }
  return dx < 0 ? "next" : "previous";
}

export function stepIndex(
  index: number,
  direction: "next" | "previous",
  total: number
): number {
  if (total <= 0) return 0;
  const next = direction === "next" ? index + 1 : index - 1;
  return Math.max(0, Math.min(total - 1, next));
}

// Fetch the next page of cards a few cards before the student reaches the
// end of what's loaded, so swiping never waits on the network.
export const PREFETCH_AHEAD = 5;

export function shouldPrefetch(
  index: number,
  loaded: number,
  total: number
): boolean {
  return loaded < total && index >= loaded - PREFETCH_AHEAD;
}

// Highlights numbers / cutoffs / doses inside a card line ("15–30 min",
// "pH 7.4", "> 38.5 °C", "500 mg") as plain segments for React to render —
// never HTML, so card text can't inject markup.
const NUMBER_PATTERN =
  /(?:[<>≤≥]\s?)?\d+(?:[.,]\d+)?(?:\s?[–-]\s?\d+(?:[.,]\d+)?)?(?:\s?(?:%|mg\/kg|mg|mcg|µg|kg|g|mL|ml|L|mmHg|mmol\/L|mEq\/L|IU|units?|°C|hours?|hrs?|minutes?|mins?|min|days?|weeks?|months?|years?|h)\b|%)?/g;

export function splitHighlights(
  text: string
): { text: string; highlight: boolean }[] {
  const segments: { text: string; highlight: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const value = match[0];
    const start = match.index ?? 0;
    if (!value || !/\d/.test(value)) continue;
    if (start > last) {
      segments.push({ text: text.slice(last, start), highlight: false });
    }
    segments.push({ text: value, highlight: true });
    last = start + value.length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), highlight: false });
  }
  return segments.length ? segments : [{ text, highlight: false }];
}
