import type { ReactNode } from "react";
import type { NiroExpression } from "@/lib/niro";
import NiroCharacter from "./NiroCharacter";

// Level 1/2 Niro for meaningful moments: an empty chat, a finished level,
// a challenge. The character sits above a title, a line and any actions.
export default function NiroEmptyState({
  expression = "normal",
  size = 150,
  title,
  children,
  className,
}: {
  expression?: NiroExpression;
  size?: number;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`niro-empty${className ? ` ${className}` : ""}`}>
      <NiroCharacter expression={expression} size={size} />
      <div className="niro-empty-title">{title}</div>
      {children}
    </div>
  );
}
