import { OG_SIZE, renderOg } from "@/components/landing/og";

export const alt = "NiroLearn — فلاش كارد بالذكاء الاصطناعي من ملفاتك";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg({
    lead: "Flashcards from your own files,",
    marked: "with spaced repetition.",
    footer: "Made from your PDF · Rated by you · Back when due",
  });
}
