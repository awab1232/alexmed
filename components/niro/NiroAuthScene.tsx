import type { ReactNode } from "react";
import NiroCharacter from "./NiroCharacter";
import NiroSpark from "./NiroSpark";
import type { NiroExpression } from "@/lib/niro";

// Static positions (no randomness) so server and client render identically.
const STARS: { x: number; y: number; s: number; d: number }[] = [
  { x: 8, y: 7, s: 2, d: 0 },
  { x: 21, y: 16, s: 1.5, d: 1.8 },
  { x: 34, y: 5, s: 1, d: 3.1 },
  { x: 47, y: 12, s: 2, d: 0.9 },
  { x: 62, y: 4, s: 1.5, d: 2.4 },
  { x: 74, y: 15, s: 1, d: 4.2 },
  { x: 88, y: 8, s: 2, d: 1.2 },
  { x: 94, y: 22, s: 1.5, d: 3.6 },
  { x: 5, y: 28, s: 1, d: 2.7 },
  { x: 16, y: 38, s: 1.5, d: 0.4 },
  { x: 83, y: 34, s: 1, d: 1.5 },
  { x: 68, y: 26, s: 2, d: 3.9 },
  { x: 28, y: 27, s: 1, d: 4.8 },
  { x: 55, y: 22, s: 1, d: 2.1 },
];

const SPARKS: { x: number; size: number; dur: number; delay: number }[] = [
  { x: 10, size: 14, dur: 16, delay: -3 },
  { x: 24, size: 10, dur: 20, delay: -11 },
  { x: 43, size: 12, dur: 18, delay: -7 },
  { x: 61, size: 9, dur: 22, delay: -15 },
  { x: 78, size: 13, dur: 17, delay: -1 },
  { x: 91, size: 10, dur: 21, delay: -9 },
];

// 🌌 The login / sign-up stage: a calm night sky (drifting aurora glows,
// twinkling stars, sparks rising slowly) with Niro greeting the student from
// above the form card (Level 2 presence — he says hello, the form stays the
// focus). All motion is CSS (.niro-auth-*), frozen under reduced motion.
export default function NiroAuthScene({
  expression,
  line,
  children,
}: {
  expression: NiroExpression;
  line: string;
  children: ReactNode;
}) {
  return (
    <div className="niro-auth">
      <div className="niro-auth-sky" aria-hidden="true">
        <span className="niro-auth-aurora is-a" />
        <span className="niro-auth-aurora is-b" />
        <span className="niro-auth-aurora is-c" />
        {STARS.map((star, i) => (
          <span
            key={i}
            className="niro-auth-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.s * 2,
              height: star.s * 2,
              animationDelay: `${star.d}s`,
            }}
          />
        ))}
        {SPARKS.map((spark, i) => (
          <span
            key={i}
            className="niro-auth-rise"
            style={{
              left: `${spark.x}%`,
              animationDuration: `${spark.dur}s`,
              animationDelay: `${spark.delay}s`,
            }}
          >
            <NiroSpark size={spark.size} />
          </span>
        ))}
      </div>

      <div className="niro-auth-main">
        <p className="niro-auth-brand">
          <NiroSpark size={20} motion="glow" />
          NiroLearn
        </p>
        <div className="niro-auth-hero">
          <span className="niro-auth-halo" aria-hidden="true" />
          <p className="niro-auth-bubble" role="status">
            {line}
          </p>
          <NiroCharacter
            expression={expression}
            size={176}
            className="niro-auth-char"
          />
        </div>
        <div className="niro-auth-card bg-card text-card-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
