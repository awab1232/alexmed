import { describe, expect, it } from "vitest";
import {
  parseCardQuestion,
  resolveCardAnswer,
  type TextRange,
} from "./mirror-card-question";

const slice = (text: string, range: TextRange) =>
  text.slice(range.start, range.end);

function parsed(text: string, arabic = false) {
  const result = parseCardQuestion(text, { arabic });
  return {
    stem: slice(text, result.stem),
    options: result.options.map(range => slice(text, range)),
  };
}

// Shapes taken from real مِرآة cards.
describe("parseCardQuestion", () => {
  it("options one per line, numbered question", () => {
    expect(
      parsed(
        "88. At what point should the spine be stabilized?\nA. After securing the airway\nB. During airway management\nC. After imaging\nD. Never"
      )
    ).toEqual({
      stem: "At what point should the spine be stabilized?",
      options: [
        "After securing the airway",
        "During airway management",
        "After imaging",
        "Never",
      ],
    });
  });

  it("options inline on one line", () => {
    expect(
      parsed(
        "How do you classify this child? A. mastoiditis B. acute ear infection C. chronic ear infection D. no ear infection"
      )
    ).toEqual({
      stem: "How do you classify this child?",
      options: [
        "mastoiditis",
        "acute ear infection",
        "chronic ear infection",
        "no ear infection",
      ],
    });
  });

  it("lowercase letters", () => {
    expect(
      parsed(
        "61. Diagnosis?\na. Concussion.\nb. Fatal concussion.\nc. Compression."
      ).options
    ).toEqual(["Concussion.", "Fatal concussion.", "Compression."]);
  });

  it("drops an 'Answer: B.' tail from the last option", () => {
    expect(
      parsed(
        "44. Disturbance? A. Uncompensated B. Partially compensated C. Fully compensated D. Respiratory. Answer: B."
      ).options
    ).toEqual([
      "Uncompensated",
      "Partially compensated",
      "Fully compensated",
      "Respiratory.",
    ]);
  });

  it("an 'A.' inside the stem with no B after it is not an option list", () => {
    expect(parsed("Which is true of vitamin A. deficiency?")).toEqual({
      stem: "Which is true of vitamin A. deficiency?",
      options: [],
    });
  });

  it("a plain question has no options (shown as before)", () => {
    expect(parsed("What is a common cause of euvolemic hyponatremia?")).toEqual(
      {
        stem: "What is a common cause of euvolemic hyponatremia?",
        options: [],
      }
    );
  });

  it("Arabic: أ/ب/ج/د lines and Arabic-Indic numbering", () => {
    expect(
      parsed(
        "٤٤. ما السبب الشائع؟\nأ. فشل القلب\nب. تليف الكبد\nج. فرط الإفراز (SIADH)\nد. الإسهال",
        true
      )
    ).toEqual({
      stem: "ما السبب الشائع؟",
      options: ["فشل القلب", "تليف الكبد", "فرط الإفراز (SIADH)", "الإسهال"],
    });
  });

  it("returns ranges into the original text (for card marks)", () => {
    const text = "12. Q? A. one B. two";
    const result = parseCardQuestion(text);
    expect(result.stem).toEqual({ start: 4, end: 6 });
    expect(result.options.map(r => text.slice(r.start, r.end))).toEqual([
      "one",
      "two",
    ]);
  });
});

describe("resolveCardAnswer", () => {
  const options = ["Heart failure", "Liver cirrhosis", "SIADH", "Diarrhea"];

  it.each([
    ["B. Liver cirrhosis", 1],
    ["B - Liver cirrhosis", 1],
    ["(b) cirrhosis", 1],
    ["D", 3],
    ["SIADH", 2],
    ["heart failure.", 0],
  ])("%s → %i", (answer, expected) => {
    expect(resolveCardAnswer(answer, "", options)).toBe(expected);
  });

  it("uses an inline 'Answer: C' from the question", () => {
    expect(resolveCardAnswer("the third one", "Q? Answer: C.", options)).toBe(
      2
    );
  });

  it("returns null when it can't be sure", () => {
    expect(
      resolveCardAnswer("something else entirely", "", options)
    ).toBeNull();
    expect(resolveCardAnswer("F. nothing", "", options)).toBeNull();
    expect(resolveCardAnswer("B", "", [])).toBeNull();
  });
});
