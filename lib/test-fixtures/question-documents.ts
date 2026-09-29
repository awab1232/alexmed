// Synthetic question-bank PAGE TEXTS shaped like the real failures seen in
// production (a scanned "MCQs 2026" bank read by OCR): a cover, a table of
// contents, an introduction with its own numbered list, running headers /
// footers / page numbers, options OCR ran onto one line, the next question
// buried mid-line, "Answer: B. Note: …", notes after the explanation, a
// question split across pages, and an answer key at the end. No real
// user file is used.

export const HEADER = "Forensic Medicine MCQs 2026";
export const FOOTER = "End-of-round MCQs";

const page = (n: number, body: string[]) => ({
  page: n,
  text: [HEADER, ...body, FOOTER, `Page ${n}`].join("\n"),
});

export const COVER = {
  page: 1,
  text: "FINAL MCQs BANK 2026\nFaculty of Medicine\nCamscanner",
};
export const CONTENTS = {
  page: 2,
  text: [
    "Contents",
    "1. Forensic medicine MCQs Page 4.",
    "2. Community medicine MCQs Page 9.",
    "3. Internal medicine MCQs Page 87.",
    "4. Pediatrics (IMIC) MCQs- Page 155.",
  ].join("\n"),
};
export const INTRO = {
  page: 3,
  text: [
    "Introduction",
    "Forensic medicine: focus on the images and practical sections! (Department recommendation).",
    "1. Read every question carefully before answering.",
    "2. Choose the single best answer.",
    "3. Study very well.",
  ].join("\n"),
};

// 10 real questions over pages 4–8 (+ an answer key on page 9).
export const QUESTION_PAGES = [
  page(4, [
    "1. A boy is brought to the emergency department with an altered level of consciousness. Which of the following statements is most correct?",
    "A. The injury suggests impact by a heavy blunt object.",
    "B. The cause of death is brain concussion and laceration.",
    "C. Skull X-ray would most likely show a depressed fracture.",
    "D. The presentation strongly suggests assault.",
    "Answer: C",
    // Options OCR put on ONE line:
    "2. In forensic practice, the hydrostatic test is primarily used to differentiate between? A. The age of the deceased. B. Stillbirth and live birth. C. Natural and homicidal death. D. The cause and manner of death.",
    // The answer and a note on the same line, then more notes:
    "Answer: B. Note: The test is unreliable after putrefaction.",
    "Note A: Air in the lungs means the child breathed.",
    "Note B: Artificial respiration can give a false positive.",
  ]),
  page(5, [
    "3. Which of the following is specific for judicial hanging?",
    "A. Dribbling of saliva. B. Cyanosis of face.",
    // …and the NEXT question buried mid-line after option C:
    "C. Fracture-dislocation of the cervical spine. D. Petechial hemorrhages. 4. Which of the following findings indicates a live-born child?",
    "A. Air in the lungs.",
    "B. Meconium in the intestine.",
    "C. A flat chest.",
    "D. An attached umbilical cord.",
    "Answer: A",
    "Explanation: A. is correct because only a breathing child has air in the lungs. B. and C. are seen in stillbirths too.",
    // Q5 starts at the bottom of page 5…
    "5. A 35-year-old man sustained a fracture of the femur following a road traffic accident. Two days later he became confused and",
  ]),
  page(6, [
    // …and continues on page 6 (after the running header).
    "developed petechiae over the chest. What is the most likely diagnosis?",
    "A. Fat embolism.",
    "B. Venous air embolism.",
    "C. Neurogenic shock.",
    "D. Pulmonary thromboembolism.",
    "Correct answer: A",
    "6. Which of the following is NOT a step in DNA processing?",
    "A. DNA extraction.",
    "B. Polymerase chain reaction.",
    "C. Photographic identification.",
    "D. Separation by electrophoresis.",
    "Ans: C",
  ]),
  page(7, [
    "7. Which site should be examined by X-ray to determine whether a person is over 21 years?",
    "A. Sternal end of the clavicle.",
    "B. Proximal end of the radius.",
    "C. Distal end of the metacarpals.",
    "D. Proximal end of the humerus.",
    "Answer: A",
    "Explanation: The medial clavicular epiphysis fuses last.",
    // Q8–Q10 have no inline answer: it comes from the key on page 9.
    "8. Blood extravasation into the carotid intima is suggestive of which of the following?",
    "A. Postmortem suspension of the body.",
    "B. Antemortem hanging.",
    "C. Death due to poisoning.",
    "D. Natural death due to atherosclerosis.",
  ]),
  page(8, [
    "9. Which injury is classically associated with a ring fracture of the skull?",
    "A. Boxer injury to the chin.",
    "B. Lateral blow to the temporal region.",
    "C. Fall from height landing on the feet.",
    "D. Occipital injury due to a fall backward.",
    "10. What is meant by the annealing step in PCR?",
    "A. Separation of double-stranded DNA.",
    "B. Attachment of primers to target sequences.",
    "C. Synthesis of new DNA strands.",
    "D. Separation of fragments by electrophoresis.",
  ]),
];

export const ANSWER_KEY = page(9, ["Answer Key", "8. B", "9. C", "10. B"]);

export const FULL_BANK = [
  COVER,
  CONTENTS,
  INTRO,
  ...QUESTION_PAGES,
  ANSWER_KEY,
];
