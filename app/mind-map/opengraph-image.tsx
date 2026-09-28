import { OG_SIZE, renderOg } from "@/components/landing/og";

export const alt = "NiroLearn — خريطة ذهنية بالذكاء الاصطناعي من ملف PDF";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({
    lead: "A mind map for every part",
    marked: "of your lecture.",
    footer: "Concepts · Links · High-yield exam points",
  });
}
