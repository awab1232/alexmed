// Test fixture for the full-document-coverage regression tests: a REAL
// 40-page PDF (written byte-by-byte below — no PDF library in the project)
// shaped like the reported bug:
//   pages 1–3  → lecturer bio / objectives / course info (metadata)
//   pages 4–40 → actual medical teaching content
// with deliberately unique, invented facts on late pages (35, 36, 37, 39,
// 40) so any output built from them is unambiguous to detect.

export const LATE_PAGE_FACTS: Record<
  number,
  { keyword: string; fact: string }
> = {
  35: {
    keyword: "Karvellin",
    fact: "Rare disease Karvellin syndrome is treated with Oxetrazine 250 mg twice daily for 14 days.",
  },
  36: {
    keyword: "Mirelle",
    fact: "The diagnostic hallmark of Doruvian nephritis is lavender-staining Mirelle bodies on renal biopsy.",
  },
  37: {
    keyword: "Quanidrol",
    fact: "Pelostine toxicity is reversed by the specific antidote Quanidrol given intravenously.",
  },
  39: {
    keyword: "Tavrennic",
    fact: "Tavrennic fever presents with a pathognomonic cobalt-blue discoloration of the tongue.",
  },
  40: {
    keyword: "Brisolan",
    fact: "The first-line surgical management of Brisolan hernia is the Halvard-Ostrin repair.",
  },
};

const METADATA_PAGES = [
  "About the lecturer. Dr. Samir Haddad is an Assistant Professor of Internal Medicine at the Faculty of Medicine, University of Jordan. He completed his residency and fellowship abroad and has taught this course for twelve years. Contact: s.haddad@example.edu. Office hours are Sunday and Tuesday. Prepared by Dr. Samir Haddad for the fifth-year students, academic year 2026.",
  "Learning objectives. By the end of this lecture series the student should be able to list the course topics, describe the structure of the module, and prepare for the end-of-semester examination. Course: Clinical Medicine Module 5. Department of Internal Medicine. Lecture 1 of 6. Attendance policy and grading are described in the syllabus.",
  "Introduction and course information. This handout was compiled by the department for the academic year. Table of contents: acute abdomen, anemia, diabetes, hypertension, asthma, thyroid disease, renal disease, toxicology, infectious disease, surgical topics. References and further reading are listed at the end of the module. Acknowledgements to the faculty teaching committee.",
];

const TOPICS: { title: string; body: string }[] = [
  {
    title: "Acute appendicitis",
    body: "Acute appendicitis is the most common surgical cause of acute abdomen. Clinical features include periumbilical pain migrating to the right iliac fossa, anorexia, nausea and low-grade fever. Diagnosis is clinical, supported by leukocytosis and ultrasound or CT. The Alvarado score helps stratify risk. Management is appendicectomy; complications include perforation, abscess and peritonitis.",
  },
  {
    title: "Iron deficiency anemia",
    body: "Iron deficiency anemia is a microcytic hypochromic anemia. Causes include chronic blood loss, poor intake and malabsorption. Symptoms are fatigue, pallor and koilonychia. Investigations show low ferritin, low serum iron and high total iron binding capacity. Treatment is oral ferrous sulfate and management of the underlying cause.",
  },
  {
    title: "Type 2 diabetes mellitus",
    body: "Type 2 diabetes is characterized by insulin resistance and relative insulin deficiency. Diagnosis requires fasting glucose of 7.0 mmol/L or more, or HbA1c of 6.5 percent or more. First-line therapy is metformin with lifestyle changes. Complications include retinopathy, nephropathy, neuropathy and cardiovascular disease.",
  },
  {
    title: "Essential hypertension",
    body: "Hypertension is diagnosed when blood pressure is persistently 140/90 mmHg or higher. Risk factors include age, obesity, salt intake and family history. Management starts with lifestyle modification; drug therapy includes ACE inhibitors, calcium channel blockers and thiazide diuretics. Complications include stroke, heart failure and chronic kidney disease.",
  },
  {
    title: "Bronchial asthma",
    body: "Asthma is a chronic inflammatory airway disease with reversible bronchoconstriction. Symptoms are wheeze, cough, chest tightness and dyspnea, often worse at night. Diagnosis is supported by spirometry showing reversibility. Treatment follows a stepwise approach with inhaled corticosteroids and short-acting beta agonists.",
  },
  {
    title: "Hypothyroidism",
    body: "Hypothyroidism is most commonly caused by Hashimoto thyroiditis. Clinical features include weight gain, cold intolerance, constipation and bradycardia. Investigations show high TSH and low free T4. Treatment is levothyroxine titrated to TSH.",
  },
  {
    title: "Acute kidney injury",
    body: "Acute kidney injury is a rapid decline in renal function classified as prerenal, renal or postrenal. Causes include dehydration, nephrotoxic drugs and obstruction. Monitoring includes serum creatinine and urine output. Complications are hyperkalemia, acidosis and fluid overload.",
  },
  {
    title: "Paracetamol overdose",
    body: "Paracetamol overdose causes hepatotoxicity through the toxic metabolite NAPQI. Management uses the treatment nomogram and intravenous N-acetylcysteine as the antidote. Liver function tests and INR are monitored. Severe cases may require liver transplantation.",
  },
  {
    title: "Community-acquired pneumonia",
    body: "Community-acquired pneumonia is most often caused by Streptococcus pneumoniae. Symptoms include fever, productive cough and pleuritic chest pain. Chest X-ray shows consolidation. Severity is assessed with the CURB-65 score and treatment is empirical antibiotics.",
  },
  {
    title: "Inguinal hernia",
    body: "Inguinal hernias are indirect or direct depending on their relation to the inferior epigastric vessels. They present as a groin swelling with cough impulse. Complications include incarceration and strangulation. Management is surgical mesh repair.",
  },
];

// Deterministic page text: 1–3 metadata, 4–40 rotating topics, with the
// late-page facts appended to their pages.
export function fortyPageTexts(): string[] {
  const pages: string[] = [...METADATA_PAGES];
  for (let pageNumber = 4; pageNumber <= 40; pageNumber++) {
    const topic = TOPICS[(pageNumber - 4) % TOPICS.length];
    const fact = LATE_PAGE_FACTS[pageNumber];
    pages.push(
      [
        `${topic.title} (page ${pageNumber}).`,
        topic.body,
        ...(fact ? [`Key exam fact: ${fact.fact}`] : []),
      ].join(" ")
    );
  }
  return pages;
}

function wrap(text: string, width = 88): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// Minimal valid PDF 1.4: one Helvetica font, one content stream per page.
export function buildFortyPageMedicalPdf(): Buffer {
  const pageTexts = fortyPageTexts();
  const objects: string[] = [];
  const fontId = 3;
  const pageIds: number[] = [];
  // 1 catalog, 2 pages, 3 font, then (page, content) pairs.
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let nextId = 4;
  for (const text of pageTexts) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const lines = wrap(text);
    const stream = [
      "BT",
      "/F1 11 Tf",
      "14 TL",
      "50 760 Td",
      ...lines.map(line => `(${escapePdfText(line)}) '`),
      "ET",
    ].join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
