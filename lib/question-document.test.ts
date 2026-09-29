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

describe("unnumbered questions (a stem, then A–D options, no question number)", () => {
  const page = (n: number, lines: string[]) => ({ page: n, text: lines.join("\n") });

  it("reads each stem + options block as a question, skipping the cover and instructions", () => {
    const result = analyzeQuestionDocument([
      page(1, ["Pharmacology Review", "Second Year"]),
      page(2, [
        "Pharmacology MCQs",
        "Choose the single best answer for each question.",
        "Which drug is a loop diuretic?",
        "A. Furosemide",
        "B. Spironolactone",
        "C. Amiloride",
        "D. Mannitol",
        "Answer: A",
        "Which drug reverses heparin?",
        "A) Vitamin K",
        "B) Protamine sulfate",
        "C) Naloxone",
        "D) Flumazenil",
        "Answer: B",
      ]),
      page(3, [
        "The antidote for paracetamol overdose is:",
        "A. Atropine",
        "B. Acetylcysteine",
        "C. Deferoxamine",
        "D. Glucagon",
        "Answer: B",
      ]),
    ]);
    expect(result.needsReview).toEqual([]);
    expect(result.questions.map(q => q.questionText)).toEqual([
      "Which drug is a loop diuretic?",
      "Which drug reverses heparin?",
      "The antidote for paracetamol overdose is:",
    ]);
    expect(result.questions.map(q => q.extractedAnswerIndex)).toEqual([0, 1, 1]);
    expect(result.questions.map(q => q.sourcePage)).toEqual([2, 2, 3]);
    expect(result.questions[1].options).toEqual([
      "Vitamin K",
      "Protamine sulfate",
      "Naloxone",
      "Flumazenil",
    ]);
    const all = JSON.stringify(result.questions);
    expect(all).not.toContain("Pharmacology MCQs");
    expect(all).not.toContain("Choose the single best answer");
    expect(all).not.toContain("Second Year");
  });

  it("keeps multi-line case stems whole and wrapped options with their option", () => {
    const result = analyzeQuestionDocument([
      page(1, [
        "A 30-year-old man presents with fever and neck stiffness.",
        "Lumbar puncture shows neutrophils and low glucose.",
        "What is the most likely diagnosis?",
        "A. Viral meningitis",
        "B. Bacterial meningitis caused by",
        "streptococcus pneumoniae",
        "C. Tuberculous meningitis",
        "D. Subarachnoid haemorrhage",
        "A 5-year-old child has a barking cough.",
        "Which virus is most likely?",
        "A. Parainfluenza virus",
        "B. RSV",
        "C. Adenovirus",
        "D. Rhinovirus",
      ]),
    ]);
    expect(result.needsReview).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].questionText).toBe(
      "A 30-year-old man presents with fever and neck stiffness. Lumbar puncture shows neutrophils and low glucose. What is the most likely diagnosis?"
    );
    expect(result.questions[0].options![1]).toBe(
      "Bacterial meningitis caused by streptococcus pneumoniae"
    );
    expect(result.questions[1].questionText).toBe(
      "A 5-year-old child has a barking cough. Which virus is most likely?"
    );
  });

  it("links an answer key at the end by the questions' order", () => {
    const stems = ["Which is a beta blocker?", "Which is an ACE inhibitor?", "Which is a statin?"];
    const result = analyzeQuestionDocument([
      page(1, stems.flatMap(stem => [stem, "A. Propranolol", "B. Enalapril", "C. Atorvastatin", "D. Digoxin"])),
      page(2, ["Answer Key", "1. A", "2. B", "3. C"]),
    ]);
    expect(result.questions.map(q => q.questionText)).toEqual(stems);
    expect(result.questions.map(q => q.extractedAnswerIndex)).toEqual([0, 1, 2]);
  });

  it("a question whose stem is on the previous page's end stays one question", () => {
    const result = analyzeQuestionDocument([
      page(1, [
        "Which vitamin deficiency causes scurvy?",
        "A. Vitamin A",
        "B. Vitamin B12",
        "C. Vitamin C",
        "D. Vitamin D",
        "Which hormone lowers blood glucose?",
      ]),
      page(2, ["A. Glucagon", "B. Insulin", "C. Cortisol", "D. Adrenaline"]),
    ]);
    expect(result.needsReview).toEqual([]);
    expect(result.questions.map(q => q.questionText)).toEqual([
      "Which vitamin deficiency causes scurvy?",
      "Which hormone lowers blood glucose?",
    ]);
    expect(result.questions[1].options).toEqual(["Glucagon", "Insulin", "Cortisol", "Adrenaline"]);
  });
});

describe("unnumbered questions with explanations between them", () => {
  it("the explanation stays with its question; the next stem starts a new one", () => {
    const result = analyzeQuestionDocument([
      {
        page: 1,
        text: [
          "Which nerve supplies the deltoid?",
          "a) Radial nerve",
          "b) Axillary nerve",
          "c) Median nerve",
          "d) Ulnar nerve",
          "Answer: b",
          "Explanation: the axillary nerve (C5, C6) supplies the deltoid",
          "and teres minor.",
          "Which muscle is the main flexor of the hip?",
          "a) Iliopsoas",
          "b) Gluteus maximus",
          "c) Sartorius",
          "d) Rectus femoris",
          "Answer: a",
        ].join("\n"),
      },
    ]);
    expect(result.needsReview).toEqual([]);
    expect(result.questions.map(q => q.questionText)).toEqual([
      "Which nerve supplies the deltoid?",
      "Which muscle is the main flexor of the hip?",
    ]);
    expect(result.questions[0].explanationText).toBe(
      "the axillary nerve (C5, C6) supplies the deltoid and teres minor."
    );
    expect(result.questions.map(q => q.extractedAnswerIndex)).toEqual([1, 0]);
  });
});

describe("unnumbered questions with أ / ب / ج / د options", () => {
  it("an Arabic bank: each stem + أ–د block is one question with its answer", () => {
    const result = analyzeQuestionDocument([
      { page: 1, text: ["بنك أسئلة علم الأدوية", "إعداد: د. أحمد"].join("\n") },
      {
        page: 2,
        text: [
          "اختر الإجابة الصحيحة لكل سؤال.",
          "أي من الأدوية التالية مدر عروي؟",
          "أ) فوروسيميد",
          "ب) سبيرونولاكتون",
          "ج) أميلوريد",
          "د) مانيتول",
          "الإجابة: أ",
          "ما هو ترياق الهيبارين؟",
          "أ- فيتامين ك",
          "ب- كبريتات البروتامين",
          "ج- نالوكسون",
          "د- فلومازينيل",
          "الإجابة: ب",
        ].join("\n"),
      },
    ]);
    expect(result.needsReview).toEqual([]);
    expect(result.questions.map(q => q.questionText)).toEqual([
      "أي من الأدوية التالية مدر عروي؟",
      "ما هو ترياق الهيبارين؟",
    ]);
    expect(result.questions[1].options).toEqual([
      "فيتامين ك",
      "كبريتات البروتامين",
      "نالوكسون",
      "فلومازينيل",
    ]);
    expect(result.questions.map(q => q.extractedAnswerIndex)).toEqual([0, 1]);
    expect(JSON.stringify(result.questions)).not.toContain("د. أحمد");
  });

  it("Arabic letters with English option text", () => {
    const result = analyzeQuestionDocument([
      {
        page: 1,
        text: [
          "أي من التالي يعتبر من حاصرات بيتا؟",
          "أ) Propranolol",
          "ب) Enalapril",
          "ج) Atorvastatin",
          "د) Digoxin",
          "ما هو دواء الستاتين من بين التالي؟",
          "أ) Propranolol",
          "ب) Enalapril",
          "ج) Atorvastatin",
          "د) Digoxin",
        ].join("\n"),
      },
    ]);
    expect(result.needsReview).toEqual([]);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].options).toEqual([
      "Propranolol",
      "Enalapril",
      "Atorvastatin",
      "Digoxin",
    ]);
  });

  it("an English question followed by its Arabic version stays ONE bilingual question", () => {
    const result = analyzeQuestionDocument([
      {
        page: 1,
        text: [
          "Which drug is a loop diuretic?",
          "A. Furosemide",
          "B. Spironolactone",
          "C. Amiloride",
          "D. Mannitol",
          "أي من الأدوية التالية مدر عروي؟",
          "أ) فوروسيميد",
          "ب) سبيرونولاكتون",
          "ج) أميلوريد",
          "د) مانيتول",
          "Which drug reverses heparin?",
          "A. Vitamin K",
          "B. Protamine sulfate",
          "C. Naloxone",
          "D. Flumazenil",
          "ما هو ترياق الهيبارين؟",
          "أ) فيتامين ك",
          "ب) كبريتات البروتامين",
          "ج) نالوكسون",
          "د) فلومازينيل",
        ].join("\n"),
      },
    ]);
    expect(result.needsReview).toEqual([]);
    expect(result.questions.map(q => q.questionText)).toEqual([
      "Which drug is a loop diuretic?",
      "Which drug reverses heparin?",
    ]);
    expect(result.questions[0].questionTextAr).toBe("أي من الأدوية التالية مدر عروي؟");
    expect(result.questions[1].optionsAr).toEqual([
      "فيتامين ك",
      "كبريتات البروتامين",
      "نالوكسون",
      "فلومازينيل",
    ]);
  });
});

describe("unnumbered: a stem whose first line is short", () => {
  it("keeps 'Regarding the heart' / 'which is true?' together", () => {
    const result = analyzeQuestionDocument([
      {
        page: 1,
        text: [
          "Regarding the heart",
          "which statement is true?",
          "A. It has three chambers",
          "B. The SA node is the pacemaker",
          "C. The aorta leaves the right ventricle",
          "D. Valves are made of muscle",
          "Answer: B",
          "Which vessel carries oxygenated blood to the heart?",
          "A. Pulmonary artery",
          "B. Pulmonary vein",
          "C. Vena cava",
          "D. Aorta",
          "Answer: B",
        ].join("\n"),
      },
    ]);
    expect(result.questions.map(q => q.questionText)).toEqual([
      "Regarding the heart which statement is true?",
      "Which vessel carries oxygenated blood to the heart?",
    ]);
  });
});
