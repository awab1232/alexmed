import type { NiroExpression } from "@/lib/niro";
import NiroCharacter from "./NiroCharacter";
import NiroSpark from "./NiroSpark";

// Level 3 Niro: his face in a small navy circle — the everyday AI identity
// (bottom nav, chat headers/messages, "Ask Niro" actions). `spark` adds the
// Niro Spark on the rim (active nav item, AI working).
export default function NiroAvatar({
  size = 32,
  expression = "normal",
  spark,
  animated = false,
  className,
  label,
}: {
  size?: number;
  expression?: NiroExpression;
  spark?: "glow" | "think" | "none";
  animated?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`niro-avatar${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <NiroCharacter
        crop="head"
        expression={expression}
        size={Math.round(size * 1.12)}
        animated={animated}
      />
      {spark && spark !== "none" && (
        <NiroSpark
          size={Math.max(10, Math.round(size * 0.42))}
          motion={spark}
          className="niro-avatar-spark"
        />
      )}
    </span>
  );
}
