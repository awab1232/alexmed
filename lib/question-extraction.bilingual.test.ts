import { describe, expect, it } from "vitest";
import { extractQuestionsFromPages, isArabicText } from "./question-extraction";

const page = (text: string, n = 1) => ({ page: n, text });

describe("bilingual question files", () => {
  it("splits an Arabic block (numbered ١, أ/ب/ج/د, الإجابة) off the English question", () => {
    const [q, ...rest] = extractQuestionsFromPages([
      page(
        [
          "1. Which nerve supplies the deltoid?",
          "A. Radial nerve",
          "B. Axillary nerve",
          "C. Median nerve",
          "D. Ulnar nerve",
          "Answer: B",
          "١. أي عصب يغذي العضلة الدالية؟",
          "أ. العصب الكعبري",
          "ب. العصب الإبطي",
          "ج. العصب الأوسط",
          "د. العصب الزندي",
          "الإجابة: ب",
        ].join("\n")
      ),
    ]);
    expect(rest).toEqual([]);
    expect(q).toMatchObject({
      questionText: "Which nerve supplies the deltoid?",
      options: [
        "Radial nerve",
        "Axillary nerve",
        "Median nerve",
        "Ulnar nerve",
      ],
      extractedAnswerIndex: 1,
      questionTextAr: "أي عصب يغذي العضلة الدالية؟",
      optionsAr: [
        "العصب الكعبري",
        "العصب الإبطي",
        "العصب الأوسط",
        "العصب الزندي",
      ],
    });
    // The answer never leaks into the Arabic text.
    expect(JSON.stringify(q.optionsAr) + q.questionTextAr).not.toMatch(
      /الإجابة/
    );
  });

  it("an Arabic block numbered like the English one is NOT a second question", () => {
    const questions = extractQuestionsFromPages([
      page(
        [
          "1. First question?",
          "A. a1",
          "B. b1",
          "C. c1",
          "D. d1",
          "Answer: A",
          "1. السؤال الأول؟",
          "1. خيار أول",
          "2. خيار ثان",
          "3. خيار ثالث",
          "4. خيار رابع",
          "الإجابة: أ",
          "2. Second question?",
          "A. a2",
          "B. b2",
          "C. c2",
          "D. d2",
          "Answer: D",
          "2. السؤال الثاني؟",
          "١. خيار ١",
          "٢. خيار ٢",
          "٣. خيار ٣",
          "٤. خيار ٤",
        ].join("\n")
      ),
    ]);
    expect(questions.map(q => q.questionText)).toEqual([
      "First question?",
      "Second question?",
    ]);
    expect(questions[0].optionsAr).toEqual([
      "خيار أول",
      "خيار ثان",
      "خيار ثالث",
      "خيار رابع",
    ]);
    expect(questions[1]).toMatchObject({
      questionTextAr: "السؤال الثاني؟",
      optionsAr: ["خيار ١", "خيار ٢", "خيار ٣", "خيار ٤"],
      extractedAnswerIndex: 3,
    });
  });

  it("handles an unnumbered Arabic block and wrapped Arabic lines", () => {
    const [q] = extractQuestionsFromPages([
      page(
        [
          "3. Which chamber pumps into the aorta?",
          "A. Right atrium",
          "B. Right ventricle",
          "C. Left atrium",
          "D. Left ventricle",
          "Answer: D",
          "أي حجرة من حجرات القلب",
          "تضخ الدم إلى الشريان الأبهر؟",
          "أ) الأذين الأيمن",
          "ب) البطين الأيمن",
          "ج) الأذين الأيسر",
          "د) البطين الأيسر",
        ].join("\n")
      ),
    ]);
    expect(q.questionTextAr).toBe(
      "أي حجرة من حجرات القلب تضخ الدم إلى الشريان الأبهر؟"
    );
    expect(q.optionsAr).toEqual([
      "الأذين الأيمن",
      "البطين الأيمن",
      "الأذين الأيسر",
      "البطين الأيسر",
    ]);
  });

  it("splits Arabic carried at the end of English lines", () => {
    const [q] = extractQuestionsFromPages([
      page(
        [
          "4. Normal adult heart rate? المعدل الطبيعي لنبض القلب عند البالغين؟",
          "A. 20-40 bpm 20-40 نبضة في الدقيقة",
          "B. 60-100 bpm 60-100 نبضة في الدقيقة",
          "C. 120-160 bpm 120-160 نبضة في الدقيقة",
          "D. 180-220 bpm 180-220 نبضة في الدقيقة",
          "Answer: B",
        ].join("\n")
      ),
    ]);
    expect(q.questionText).toBe("Normal adult heart rate?");
    expect(q.options).toEqual([
      "20-40 bpm",
      "60-100 bpm",
      "120-160 bpm",
      "180-220 bpm",
    ]);
    expect(q.questionTextAr).toBe("المعدل الطبيعي لنبض القلب عند البالغين؟");
    expect(q.optionsAr).toHaveLength(4);
    expect(q.extractedAnswerIndex).toBe(1);
  });

  it("an inline 'الإجابة: ب' at the end of an Arabic line is taken as the answer and removed", () => {
    const [q] = extractQuestionsFromPages([
      page(
        [
          "5. Question five?",
          "A. a",
          "B. b",
          "C. c",
          "D. d",
          "٥. السؤال الخامس؟",
          "أ. أ",
          "ب. ب",
          "ج. ج",
          "د. نص الخيار الرابع الإجابة: ج",
        ].join("\n")
      ),
    ]);
    expect(q.extractedAnswerIndex).toBe(2);
    expect(q.optionsAr?.[3]).toBe("نص الخيار الرابع");
  });

  it("the English answer wins over a conflicting Arabic one", () => {
    const [q] = extractQuestionsFromPages([
      page(
        [
          "1. Which vessel is affected?",
          "A. a",
          "B. b",
          "Answer: A",
          "١. س؟",
          "أ. أ",
          "ب. ب",
          "الإجابة: ب",
        ].join("\n")
      ),
    ]);
    expect(q.extractedAnswerIndex).toBe(0);
  });

  it("leaves optionsAr null when the Arabic options don't line up (the question text is still kept)", () => {
    const [q] = extractQuestionsFromPages([
      page(
        [
          "1. Which vessel is affected?",
          "A. a",
          "B. b",
          "C. c",
          "D. d",
          "Answer: A",
          "١. سؤال؟",
          "أ. واحد",
          "ب. اثنان",
        ].join("\n")
      ),
    ]);
    expect(q.questionTextAr).toBe("سؤال؟");
    expect(q.optionsAr).toBeNull();
  });

  it("an Arabic-only file is its own language: Arabic question and options, nothing to translate", () => {
    const questions = extractQuestionsFromPages([
      page(
        [
          "١. ما هي عاصمة الأردن؟",
          "أ. إربد",
          "ب. عمّان",
          "ج. الزرقاء",
          "د. العقبة",
          "الإجابة: ب",
          "٢. سؤال ثان؟",
          "أ. نعم",
          "ب. لا",
        ].join("\n")
      ),
    ]);
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      questionText: "ما هي عاصمة الأردن؟",
      options: ["إربد", "عمّان", "الزرقاء", "العقبة"],
      extractedAnswerIndex: 1,
      questionTextAr: null,
      optionsAr: null,
    });
  });

  it("English-only files are parsed exactly as before, with no Arabic fields", () => {
    const [q] = extractQuestionsFromPages([
      page(
        [
          "1. Plain question?",
          "A. one",
          "B. two",
          "Answer: B",
          "Explanation: because",
        ].join("\n")
      ),
    ]);
    expect(q).toMatchObject({
      questionText: "Plain question?",
      options: ["one", "two"],
      extractedAnswerIndex: 1,
      explanationText: "because",
      questionTextAr: null,
      optionsAr: null,
    });
  });

  it("isArabicText: English terms inside Arabic stay Arabic", () => {
    expect(isArabicText("العصب Axillary nerve يغذي العضلة")).toBe(true);
    expect(isArabicText("Axillary nerve")).toBe(false);
  });
});
