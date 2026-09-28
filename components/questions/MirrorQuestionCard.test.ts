import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { highlightsInRange } from "@/components/CardMarks";
import MirrorQuestionCard, { type MirrorCardData } from "./MirrorQuestionCard";

// A real مِرآة card shape: options inside the question text, answer as text.
const card: MirrorCardData = {
  question:
    "What is a common cause of euvolemic hyponatremia?\nA. Heart failure\nB. Liver cirrhosis\nC. SIADH\nD. Diarrhea",
  questionArabic:
    "ما هو السبب الشائع لانخفاض صوديوم الدم؟\nأ. فشل القلب\nب. تليف الكبد\nج. SIADH\nد. الإسهال",
  answer: "SIADH",
  answerArabic: "فرط إفراز الهرمون المضاد للبول",
  explanation: "SIADH causes water retention with normal volume.",
  explanationArabic: "يسبب احتباس الماء مع حجم طبيعي.",
  keyIdea: "Euvolemic = SIADH",
  keyIdeaArabic: "سوي الحجم = SIADH",
  keyword: "hyponatremia",
  keywordArabic: "نقص الصوديوم",
  confidence: "high",
  imageUrl: null,
};

function render(showAnswer: boolean, data: MirrorCardData = card) {
  return renderToStaticMarkup(
    createElement(MirrorQuestionCard, {
      card: data,
      originTag: "PDF",
      showAnswer,
      onReveal: () => undefined,
      onReset: () => undefined,
    })
  );
}

describe("MirrorQuestionCard", () => {
  it("before answering: stem + four tappable options + the reveal button, nothing revealed", () => {
    const html = render(false);
    expect(html).toContain("What is a common cause of euvolemic hyponatremia?");
    expect(html.match(/role="button"[^>]*data-state="idle"/g)).toHaveLength(4);
    expect(html).toContain("اظهر الإجابة والشرح");
    expect(html).toContain("عرض الترجمة");
    expect(html).toContain("QUESTION · PDF");
    expect(html).not.toContain("water retention");
    expect(html).not.toContain("ما هو السبب الشائع");
  });

  it("after 'show answer': the right option (resolved from the answer text) is green, and every existing section is shown", () => {
    const html = render(true);
    expect(html.match(/data-state="correct"/g)).toHaveLength(1);
    // SIADH is option 3.
    expect(html).toMatch(/data-state="correct"[\s\S]*?SIADH/);
    for (const text of [
      "فرط إفراز الهرمون المضاد للبول",
      "SIADH causes water retention with normal volume.",
      "يسبب احتباس الماء مع حجم طبيعي.",
      "الفكرة الأساسية",
      "Euvolemic = SIADH",
      "الكلمة المفتاحية",
      "hyponatremia",
      "نقص الصوديوم",
      "إعادة",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("اظهر الإجابة والشرح");
  });

  it("every piece of the question stays a markable part of the SAME field (card marks keep working)", () => {
    const html = render(false);
    expect(html.match(/data-mark-field="question"/g)).toHaveLength(5);
    expect(html).toMatch(/data-mark-field="question" data-mark-offset="0"/);
  });

  it("a question without options is shown whole, exactly as before", () => {
    const html = render(false, {
      ...card,
      question: "Define euvolemic hyponatremia.",
      answer: "Low sodium with normal volume.",
    });
    expect(html).toContain("Define euvolemic hyponatremia.");
    expect(html).not.toContain('role="button"');
    expect(html).toContain("اظهر الإجابة والشرح");
  });
});

describe("highlightsInRange", () => {
  const h = (start: number, end: number) => ({
    id: "x",
    field: "question" as const,
    start,
    end,
    color: "#ff0",
  });

  it("keeps, clips and shifts highlights into a part of the field", () => {
    expect(highlightsInRange([h(5, 12)], { start: 10, end: 20 })).toEqual([
      { ...h(0, 2) },
    ]);
    expect(highlightsInRange([h(12, 15)], { start: 10, end: 20 })).toEqual([
      { ...h(2, 5) },
    ]);
    expect(
      highlightsInRange([h(0, 5), h(25, 30)], { start: 10, end: 20 })
    ).toEqual([]);
  });
});
