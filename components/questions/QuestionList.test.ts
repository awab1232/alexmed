import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuestionList, {
  watermarkTile,
  type QuestionListItem,
} from "./QuestionList";

const question: QuestionListItem = {
  id: "q1",
  questionText: "Which nerve supplies the deltoid?",
  options: ["Radial", "Axillary", "Median"],
  extractedAnswerIndex: 1,
  aiInferredAnswerIndex: null,
  explanationText: "Axillary nerve (C5–C6).",
  sourcePage: 4,
  keywords: ["deltoid"],
  aiExplanationAr: "العصب الإبطي",
  imageUrl: "/img/1",
};

function render(props: { watermark?: string }) {
  return renderToStaticMarkup(
    createElement(QuestionList, { questions: [question], ...props })
  );
}

describe("QuestionList", () => {
  it("renders the question, options, explanations, keywords and image", () => {
    const html = render({});
    for (const text of [
      "Which nerve supplies the deltoid?",
      "Radial",
      "Axillary",
      "Axillary nerve (C5–C6).",
      "العصب الإبطي",
      "deltoid",
      'src="/img/1"',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/سؤال (<!-- -->)?1(<!-- -->)? · صفحة (<!-- -->)?4/);
  });

  it("has no watermark unless one is asked for (owner / doctor preview)", () => {
    expect(render({})).not.toContain("question-watermark");
  });

  it("overlays a non-interactive, hidden-from-assistive-tech watermark on every card", () => {
    const html = render({ watermark: "NiroLearn · @sara · 7K2Q" });
    expect(html).toContain('data-testid="question-watermark"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events:none");
  });

  it("escapes the watermark text inside its SVG tile", () => {
    const tile = decodeURIComponent(watermarkTile(`<a href="x">&'`));
    expect(tile).toContain("&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
    expect(tile).not.toContain("<a href");
  });
});
