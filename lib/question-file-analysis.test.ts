import { describe, expect, it } from "vitest";
import {
  associateImagesWithQuestions,
  parseExtractedQuestionEnrichment,
  parsePageImageClassification,
} from "./question-file-analysis";

// TEST A-D exactly as specified in the approved plan
// (C:\Users\user\.claude\plans\imperative-brewing-river.md).
describe("associateImagesWithQuestions", () => {
  it("TEST A: one image before three questions, no next image — all three get it", () => {
    const images = [{ id: "imgA", pageNumber: 5 }];
    const questions = [
      { id: "q1", sourcePage: 5 },
      { id: "q2", sourcePage: 6 },
      { id: "q3", sourcePage: 6 },
    ];
    const relations = associateImagesWithQuestions(images, questions);
    expect(relations).toEqual([
      { questionId: "q1", imageId: "imgA" },
      { questionId: "q2", imageId: "imgA" },
      { questionId: "q3", imageId: "imgA" },
    ]);
  });

  it("TEST B: image A then Q1,Q2, image B then Q3 — B interrupts A's ownership", () => {
    const images = [
      { id: "imgA", pageNumber: 5 },
      { id: "imgB", pageNumber: 8 },
    ];
    const questions = [
      { id: "q1", sourcePage: 5 },
      { id: "q2", sourcePage: 7 },
      { id: "q3", sourcePage: 8 },
    ];
    const relations = associateImagesWithQuestions(images, questions);
    expect(relations).toEqual([
      { questionId: "q1", imageId: "imgA" },
      { questionId: "q2", imageId: "imgA" },
      { questionId: "q3", imageId: "imgB" },
    ]);
  });

  it("TEST C: no images at all — no question gets one", () => {
    const questions = [
      { id: "q1", sourcePage: 1 },
      { id: "q2", sourcePage: 2 },
      { id: "q3", sourcePage: 3 },
    ];
    expect(associateImagesWithQuestions([], questions)).toEqual([]);
  });

  it("TEST D: three images, four groups — each question falls in exactly one range", () => {
    const images = [
      { id: "imgA", pageNumber: 1 },
      { id: "imgB", pageNumber: 4 },
      { id: "imgC", pageNumber: 8 },
    ];
    const questions = [
      { id: "q1", sourcePage: 1 },
      { id: "q2", sourcePage: 2 },
      { id: "q3", sourcePage: 3 },
      { id: "q4", sourcePage: 4 },
      { id: "q5", sourcePage: 5 },
      { id: "q6", sourcePage: 6 },
      { id: "q7", sourcePage: 7 },
      { id: "q8", sourcePage: 8 },
    ];
    const relations = associateImagesWithQuestions(images, questions);
    expect(relations).toEqual([
      { questionId: "q1", imageId: "imgA" },
      { questionId: "q2", imageId: "imgA" },
      { questionId: "q3", imageId: "imgA" },
      { questionId: "q4", imageId: "imgB" },
      { questionId: "q5", imageId: "imgB" },
      { questionId: "q6", imageId: "imgB" },
      { questionId: "q7", imageId: "imgB" },
      { questionId: "q8", imageId: "imgC" },
    ]);
  });

  it("a question on a page before any image gets no image", () => {
    const images = [{ id: "imgA", pageNumber: 5 }];
    const questions = [{ id: "q1", sourcePage: 3 }];
    expect(associateImagesWithQuestions(images, questions)).toEqual([]);
  });

  it("does not assume input order is already sorted by pageNumber", () => {
    const images = [
      { id: "imgB", pageNumber: 8 },
      { id: "imgA", pageNumber: 5 },
    ];
    const questions = [{ id: "q1", sourcePage: 6 }];
    expect(associateImagesWithQuestions(images, questions)).toEqual([
      { questionId: "q1", imageId: "imgA" },
    ]);
  });

  // TEST E: live-reproduced 2026-09-19 against a real question file (مِرآة
  // job 4e088149) — pages 17/18/19 exactly, confirmed by manually reading the
  // scanned PDF. Page 17's figure is immediately followed by Q34's stem on
  // the SAME page (isAtPageEnd: false) and Q35 continues onto page 18 with
  // no figure of its own; page 18's figure (a twin ultrasound) has nothing
  // after it on its own page (isAtPageEnd: true) and is really answered by
  // Q36/Q37, whose stems start fresh on page 19; page 19's own figure is
  // likewise at its page's end and belongs to Q38-40 on page 20. Before this
  // fix, Q35/Q36/Q38 all got the wrong figure (whichever page they were
  // physically extracted onto), one page off from what they actually needed.
  it("TEST E: a figure at a page's end belongs to the NEXT page's questions, not its own page's", () => {
    const images = [
      { id: "img17", pageNumber: 17, isAtPageEnd: false },
      { id: "img18", pageNumber: 18, isAtPageEnd: true },
      { id: "img19", pageNumber: 19, isAtPageEnd: true },
    ];
    const questions = [
      { id: "q34", sourcePage: 17 },
      { id: "q35", sourcePage: 18 },
      { id: "q36", sourcePage: 19 },
      { id: "q37", sourcePage: 19 },
      { id: "q38", sourcePage: 20 },
      { id: "q39", sourcePage: 20 },
      { id: "q40", sourcePage: 20 },
    ];
    expect(associateImagesWithQuestions(images, questions)).toEqual([
      { questionId: "q34", imageId: "img17" },
      { questionId: "q35", imageId: "img17" },
      { questionId: "q36", imageId: "img18" },
      { questionId: "q37", imageId: "img18" },
      { questionId: "q38", imageId: "img19" },
      { questionId: "q39", imageId: "img19" },
      { questionId: "q40", imageId: "img19" },
    ]);
  });

  it("TEST E continued: two consecutive page-end images each still own exactly their own shifted range", () => {
    const images = [
      { id: "imgA", pageNumber: 4, isAtPageEnd: true }, // shifts to 5
      { id: "imgB", pageNumber: 5, isAtPageEnd: true }, // shifts to 6 — narrows imgA's range to just [5,6)
    ];
    const questions = [
      { id: "q1", sourcePage: 5 },
      { id: "q2", sourcePage: 6 },
    ];
    expect(associateImagesWithQuestions(images, questions)).toEqual([
      { questionId: "q1", imageId: "imgA" },
      { questionId: "q2", imageId: "imgB" },
    ]);
  });

  it("treats a missing isAtPageEnd exactly like false (backward compatible with TEST A-D's fixtures)", () => {
    const images = [{ id: "imgA", pageNumber: 5 }];
    const questions = [{ id: "q1", sourcePage: 5 }];
    expect(associateImagesWithQuestions(images, questions)).toEqual([
      { questionId: "q1", imageId: "imgA" },
    ]);
  });
});

describe("parsePageImageClassification", () => {
  it("parses a fenced JSON response", () => {
    const content =
      '```json\n{"hasImage": true, "captionEn": "A Karman cannula set"}\n```';
    expect(parsePageImageClassification(content)).toEqual({
      hasImage: true,
      captionEn: "A Karman cannula set",
    });
  });
});

describe("parseExtractedQuestionEnrichment", () => {
  it("parses keywords/explanation/inferredAnswerIndex", () => {
    const content = JSON.stringify({
      keywords: ["ECG", "arrhythmia"],
      explanationAr:
        "التشخيص هو Atrial Fibrillation بسبب عدم انتظام R-R interval.",
      inferredAnswerIndex: 2,
    });
    expect(parseExtractedQuestionEnrichment(content)).toEqual({
      keywords: ["ECG", "arrhythmia"],
      explanationAr:
        "التشخيص هو Atrial Fibrillation بسبب عدم انتظام R-R interval.",
      inferredAnswerIndex: 2,
    });
  });

  it("parses a null inferredAnswerIndex when the source already stated an answer", () => {
    const content = JSON.stringify({
      keywords: ["mitochondria"],
      explanationAr:
        "الإجابة الصحيحة هي Mitochondria لأنها المسؤولة عن إنتاج ATP.",
      inferredAnswerIndex: null,
    });
    expect(
      parseExtractedQuestionEnrichment(content).inferredAnswerIndex
    ).toBeNull();
  });
});
