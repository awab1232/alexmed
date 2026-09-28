import { OG_SIZE, renderOg } from "@/components/landing/og";

export const alt = "NiroLearn — طريقة المذاكرة الصحيحة لملف كبير";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({
    lead: "How to study a big file",
    marked: "before the exam.",
    footer: "Active recall · Spaced repetition · Exam Focus",
  });
}
