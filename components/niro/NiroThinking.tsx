import { niroLine } from "@/lib/niro";
import NiroAvatar from "./NiroAvatar";

// "Niro is working on it" — a small avatar with a turning Niro Spark and a
// short line. Replaces generic spinners wherever Niro (the AI) is answering.
export default function NiroThinking({
  text,
  size = 26,
}: {
  text?: string;
  size?: number;
}) {
  return (
    <div className="niro-thinking" role="status" aria-live="polite">
      <NiroAvatar size={size} expression="explaining" spark="think" />
      <span>{text ?? niroLine("thinking")}</span>
      <span className="niro-thinking-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
