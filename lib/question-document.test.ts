import { describe, expect, it } from "vitest";
import { analyzeQuestionDocument } from "./question-document";
import {
  ANSWER_KEY,
  CONTENTS,
  COVER,
  FOOTER,
  FULL_BANK,
  HEADER,
  INTRO,
  QUESTION_PAGES,
} from "./test-fixtures/question-documents";

const analysis = analyzeQuestionDocument(FULL_BANK);
const q = (n: number) => analysis.questions[n - 1];

describe("A · cover + contents + introduction + 10 questions + answer key", () => {
  it("extracts exactly the 10 questions — nothing from the cover, contents or introduction", () => {
    expect(analysis.questions).toHaveLength(10);
    expect(analysis.needsReview).toEqual([]);
    const all = JSON.stringify(analysis.questions);
    for (const leak of [
      "FINAL MCQs BANK",
      "Forensic medicine MCQs Page",
      "Read every question carefully",
      "Choose the single best answer",
      "Study very well",
    ]) {
      expect(all).not.toContain(leak);
    }
  });

  it("classifies the pages", () => {
    const kind = (page: number) =>
      analysis.pages.find(p => p.page === page)!.kind;
    expect(kind(COVER.page)).toBe("cover");
    expect(kind(CONTENTS.page)).toBe("front_matter");
    expect(kind(INTRO.page)).toBe("front_matter");
    expect(kind(4)).toBe("question");
    expect(kind(ANSWER_KEY.page)).toBe("answer_key");
    expect(
      analysis.pages.filter(p => p.inQuestionSection).map(p => p.page)
    ).toEqual([4, 5, 6, 7, 8]);
  });

  it("every question has exactly its own four options", () => {
    for (const question of analysis.questions) {
      expect(question.options).toHaveLength(4);
    }
  });
});

describe("K · repeated headers, footers, page numbers and scanner marks", () => {
  it("never reach a question, an option or an explanation", () => {
    const all = JSON.stringify(analysis.questions);
    expect(all).not.toContain(HEADER);
    expect(all).not.toContain(FOOTER);
    expect(all).not.toMatch(/Page \d/);
    expect(all).not.toMatch(/camscanner/i);
  });
});

describe("OCR run-ons", () => {
  it("splits options OCR put on one line", () => {
    expect(q(2).questionText).toBe(
      "In forensic practice, the hydrostatic test is primarily used to differentiate between?"
    );
    expect(q(2).options).toEqual([
      "The age of the deceased.",
      "Stillbirth and live birth.",
      "Natural and homicidal death.",
      "The cause and manner of death.",
    ]);
  });

  it("breaks out the next question buried at the end of an option line", () => {
    expect(q(3).options).toEqual([
      "Dribbling of saliva.",
      "Cyanosis of face.",
      "Fracture-dislocation of the cervical spine.",
      "Petechial hemorrhages.",
    ]);
    expect(q(4).questionText).toBe(
      "Which of the following findings indicates a live-born child?"
    );
  });
});

describe("G · question / options / answer / explanation / notes", () => {
  it("'Answer: B. Note: …' gives answer B and a note — never a fifth option", () => {
    expect(q(2).options).toHaveLength(4);
    expect(q(2).extractedAnswerIndex).toBe(1);
    expect(q(2).extractedAnswerText).toBe("Stillbirth and live birth.");
    expect(q(2).explanationText).toContain("unreliable after putrefaction");
    expect(q(2).explanationText).toContain("Note A: Air in the lungs");
    expect(q(2).explanationText).toContain("Note B: Artificial respiration");
    expect(JSON.stringify(q(2).options)).not.toMatch(/note/i);
  });

  it("lettered sentences inside an explanation stay explanation, not options", () => {
    expect(q(4).options).toHaveLength(4);
    expect(q(4).extractedAnswerIndex).toBe(0);
    expect(q(4).explanationText).toContain(
      "is correct because only a breathing child"
    );
    expect(q(4).explanationText).toContain("are seen in stillbirths too");
  });

  it("recognises 'Correct answer:' and 'Ans:'", () => {
    expect(q(5).extractedAnswerIndex).toBe(0);
    expect(q(6).extractedAnswerIndex).toBe(2);
  });
});

describe("J · a question across two pages", () => {
  it("is one complete question, dated from the page it starts on", () => {
    expect(q(5).questionText).toBe(
      "A 35-year-old man sustained a fracture of the femur following a road traffic accident. Two days later he became confused and developed petechiae over the chest. What is the most likely diagnosis?"
    );
    expect(q(5).options).toEqual([
      "Fat embolism.",
      "Venous air embolism.",
      "Neurogenic shock.",
      "Pulmonary thromboembolism.",
    ]);
    expect(q(5).sourcePage).toBe(5);
    expect(analysis.spans[4]).toEqual({ startPage: 5, endPage: 6 });
  });
});

describe("H · an answer key at the end", () => {
  it("links the key's answers to their questions, and adds no questions", () => {
    expect(q(8).extractedAnswerText).toBe("Antemortem hanging.");
    expect(q(9).extractedAnswerText).toBe(
      "Fall from height landing on the feet."
    );
    expect(q(10).extractedAnswerText).toBe(
      "Attachment of primers to target sequences."
    );
  });

  it("never overrides an answer the question itself states", () => {
    expect(q(1).extractedAnswerIndex).toBe(2);
  });

  it("reads a packed key ('1-B 2-C 3-A') and a key whose sections restart numbering", () => {
    const pages = [
      {
        page: 1,
        text: "1. Which drug is first line?\nA. One\nB. Two\nC. Three\n2. Which dose is safe?\nA. Low\nB. High\nC. None",
      },
      { page: 2, text: "Answer Key\n1-C 2-A" },
    ];
    const { questions } = analyzeQuestionDocument(pages);
    expect(questions.map(x => x.extractedAnswerIndex)).toEqual([2, 0]);
  });
});

describe("I · incomplete questions", () => {
  const pages = [
    {
      page: 1,
      text: [
        "1. Which vitamin deficiency causes scurvy?",
        "A. Vitamin A",
        "B. Vitamin C",
        "Answer: B",
        // A stem cut off mid-sentence:
        "2. What is the most likely",
        "A. Option one",
        "B. Option two",
        // A number with options but no stem:
        "3.",
        "A. First",
        "B. Second",
        // A single option:
        "4. Which organ produces insulin?",
        "A. Pancreas",
      ].join("\n"),
    },
  ];
  const result = analyzeQuestionDocument(pages);

  it("keeps only the complete question as valid", () => {
    expect(result.questions.map(x => x.questionText)).toEqual([
      "Which vitamin deficiency causes scurvy?",
    ]);
  });

  it("reports the rest as needs-review with the reason, never inventing the missing part", () => {
    const byNumber = Object.fromEntries(
      result.needsReview.map(r => [r.number, r.reasons])
    );
    expect(byNumber[2]).toContain("incomplete_stem");
    expect(byNumber[3]).toContain("empty_or_fragment_stem");
    expect(byNumber[4]).toContain("single_option");
  });
});

describe("existing files keep working", () => {
  it("a plain text bank with no front matter parses exactly as before", () => {
    const { questions, needsReview } = analyzeQuestionDocument([
      {
        page: 1,
        text: "1. What is the powerhouse of the cell?\nA. Nucleus\nB. Mitochondria\nC. Ribosome\nD. Golgi apparatus\nAnswer: B\nExplanation: Mitochondria produce ATP.",
      },
    ]);
    expect(needsReview).toEqual([]);
    expect(questions).toEqual([
      expect.objectContaining({
        questionText: "What is the powerhouse of the cell?",
        options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"],
        extractedAnswerIndex: 1,
        explanationText: "Mitochondria produce ATP.",
      }),
    ]);
  });

  it("True/False banks keep their identical options on every page", () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({
      page: i + 1,
      text: `${i + 1}. Statement number ${i + 1} about anatomy is correct?\nA. True\nB. False`,
    }));
    const { questions } = analyzeQuestionDocument(pages);
    expect(questions).toHaveLength(5);
    for (const question of questions)
      expect(question.options).toEqual(["True", "False"]);
  });

  it("a section that restarts its numbering at 1 is new questions, not a key", () => {
    const pages = [
      {
        page: 1,
        text: "1. First section question one?\nA. a1\nB. b1\n2. First section question two?\nA. a2\nB. b2",
      },
      { page: 2, text: "Community medicine MCQs" },
      { page: 3, text: "1. Second section question one?\nA. c1\nB. d1" },
    ];
    const { questions } = analyzeQuestionDocument(pages);
    expect(questions.map(x => x.questionText)).toEqual([
      "First section question one?",
      "First section question two?",
      "Second section question one?",
    ]);
    // The divider page's title doesn't glue onto the previous question.
    expect(JSON.stringify(questions)).not.toContain("Community medicine");
  });

  it("options numbered 1–4 instead of A–D", () => {
    const { questions } = analyzeQuestionDocument([
      {
        page: 1,
        text: "12. Which of the following is a live-birth sign?\n1. Air in the lungs\n2. Maceration\n3. Spalding sign\n4. Robert sign\n13. Which test detects air in the lungs?\n1. Hydrostatic test\n2. Breslau test\n3. Wreden test\n4. Raygat test",
      },
    ]);
    expect(questions.map(x => x.options?.length)).toEqual([4, 4]);
    expect(questions[1].questionText).toBe(
      "Which test detects air in the lungs?"
    );
  });
});
