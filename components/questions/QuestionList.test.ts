import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QuestionList, {
  correctAnswerOf,
  deckProgress,
  optionState,
  watermarkTile,
  type QuestionListItem,
} from "./QuestionList";

const question: QuestionListItem = {
  id: "q1",
  questionText: "Which nerve supplies the deltoid?",
  options: ["Radial", "Axillary", "Median", "Ulnar"],
  extractedAnswerIndex: 1,
  aiInferredAnswerIndex: null,
  explanationText: "Axillary nerve (C5–C6).",
  sourcePage: 4,
  keywords: ["deltoid"],
  aiExplanationAr: "العصب الإبطي",
  imageUrl: "/img/1",
  questionTextAr: "أي عصب يغذي العضلة الدالية؟",
  optionsAr: ["الكعبري", "الإبطي", "الأوسط", "الزندي"],
  translationSource: "source",
};

function render(
  props: {
    watermark?: string;
    revealAll?: boolean;
    layout?: "deck" | "list";
  } = {},
  q: QuestionListItem = question
) {
  return renderToStaticMarkup(
    createElement(QuestionList, {
      questions: [q, { ...q, id: "q2" }],
      layout: "list",
      ...props,
    })
  );
}

describe("QuestionList — before answering", () => {
  it("shows the question, numbered options and image, with the answer hidden", () => {
    const html = render();
    for (const text of [
      "Which nerve supplies the deltoid?",
      "Radial",
      "Axillary",
      'src="/img/1"',
      "QUESTION",
      "أظهر الإجابة",
      "عرض الترجمة",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/1(<!-- -->)?\./);
    expect(html).toMatch(/1(<!-- -->)? \/ (<!-- -->)?2/);
    // Nothing reveals the answer yet: no explanation, no colours, no result.
    expect(html).not.toContain("Axillary nerve (C5–C6).");
    expect(html).not.toContain("العصب الإبطي");
    expect(html).not.toContain('data-state="correct"');
    expect(html).not.toContain("إجابة صحيحة");
    // Options are tappable buttons.
    expect(html.match(/<button[^>]*data-state="idle"/g)).toHaveLength(8);
  });

  it("keeps the translation behind its button", () => {
    const html = render();
    expect(html).not.toContain("أي عصب يغذي العضلة الدالية؟");
  });

  it("offers no translation button when there is no Arabic", () => {
    const html = render(
      {},
      { ...question, questionTextAr: null, optionsAr: null }
    );
    expect(html).not.toContain("عرض الترجمة");
  });
});

describe("QuestionList — doctor review (revealAll)", () => {
  it("shows every correct answer and explanation at once, without a wrong mark", () => {
    const html = render({ revealAll: true });
    expect(html.match(/data-state="correct"/g)).toHaveLength(2);
    expect(html).not.toContain('data-state="wrong"');
    expect(html).toContain("Axillary nerve (C5–C6).");
    expect(html).toContain("العصب الإبطي");
    expect(html).not.toContain("أظهر الإجابة");
  });

  it("labels an AI-suggested answer as such", () => {
    const html = render(
      { revealAll: true },
      { ...question, extractedAnswerIndex: null, aiInferredAnswerIndex: 2 }
    );
    expect(html).toContain("إجابة مقترحة من الذكاء");
  });
});

describe("optionState", () => {
  const card = (selected: number | null, revealed = true) => ({
    selected,
    revealed,
    correct: 1,
  });

  it("is idle for every option before answering", () => {
    for (let i = 0; i < 4; i++)
      expect(optionState(i, card(null, false))).toBe("idle");
  });

  it("a right pick: that option green, the rest dimmed", () => {
    expect(optionState(1, card(1))).toBe("correct");
    expect(optionState(0, card(1))).toBe("dimmed");
  });

  it("a wrong pick: it turns red and the correct one green", () => {
    expect(optionState(3, card(3))).toBe("wrong");
    expect(optionState(1, card(3))).toBe("correct");
    expect(optionState(0, card(3))).toBe("dimmed");
  });

  it("'show answer' without a pick: only the correct one is marked", () => {
    expect(optionState(1, card(null))).toBe("correct");
    expect(optionState(2, card(null))).toBe("dimmed");
  });

  it("no known answer: the pick is only outlined, nothing is judged", () => {
    const noAnswer = { selected: 2, revealed: true, correct: null };
    expect(optionState(2, noAnswer)).toBe("chosen");
    expect(optionState(1, noAnswer)).toBe("idle");
  });
});

describe("correctAnswerOf", () => {
  it("prefers the file's stated answer, falls back to the AI's, else none", () => {
    expect(correctAnswerOf(question)).toEqual({ index: 1, fromAi: false });
    expect(
      correctAnswerOf({
        ...question,
        extractedAnswerIndex: null,
        aiInferredAnswerIndex: 3,
      })
    ).toEqual({ index: 3, fromAi: true });
    expect(
      correctAnswerOf({
        ...question,
        extractedAnswerIndex: null,
        aiInferredAnswerIndex: null,
      })
    ).toEqual({ index: null, fromAi: false });
  });
});

describe("watermark", () => {
  it("has no watermark unless one is asked for (owner / doctor preview)", () => {
    expect(render()).not.toContain("question-watermark");
  });

  it("overlays a hidden-from-assistive-tech watermark on every card", () => {
    const html = render({ watermark: "NiroLearn · @sara · 7K2Q" });
    expect(html.match(/data-testid="question-watermark"/g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
  });

  it("escapes the watermark text inside its SVG tile", () => {
    const tile = decodeURIComponent(watermarkTile(`<a href="x">&'`));
    expect(tile).toContain("&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
    expect(tile).not.toContain("<a href");
  });
});

describe("QuestionList — deck (one question at a time)", () => {
  const deck = () =>
    renderToStaticMarkup(
      createElement(QuestionList, {
        questions: [
          question,
          { ...question, id: "q2", questionText: "Second one?" },
        ],
      })
    );

  it("shows only the current question, with progress and previous / next", () => {
    const html = deck();
    expect(html).toContain("Which nerve supplies the deltoid?");
    expect(html).not.toContain("Second one?");
    expect(html).toMatch(/السؤال (<!-- -->)?1(<!-- -->)? من (<!-- -->)?2/);
    expect(html).toContain('role="progressbar"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*السابق/);
    expect(html).toContain("التالي");
    // The picker lists every question.
    expect(html.match(/<option /g)).toHaveLength(2);
  });
});

describe("deckProgress", () => {
  it("counts answered and correct picks", () => {
    const qs = [question, { ...question, id: "q2" }, { ...question, id: "q3" }];
    expect(
      deckProgress(qs, {
        q1: { selected: 1, revealed: true },
        q2: { selected: 0, revealed: true },
        q3: { selected: null, revealed: true },
      })
    ).toEqual({ answered: 2, correct: 1 });
  });
});
