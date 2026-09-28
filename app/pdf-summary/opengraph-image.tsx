import { OG_SIZE, renderOg } from "@/components/landing/og";

export const alt = "NiroLearn — تلخيص ملفات PDF بالذكاء الاصطناعي";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({
    lead: "Summarize any PDF lecture",
    marked: "for studying, not just reading.",
    footer: "Summary per part · Exam Focus · Arabic support",
  });
}
