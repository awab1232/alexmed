// 🧠 Animated background for every Brain Games page (app/games/layout.tsx):
// slowly drifting colour glows plus faint maths symbols floating upward.
// Purely decorative — fixed behind the content, ignores taps, hidden from
// screen readers, and frozen for people who ask for reduced motion (see
// .games-backdrop in app/globals.css). Values are static (no randomness) so
// server and client render identically.
const GLYPHS: {
  char: string;
  left: number; // % from the left
  size: number; // px
  duration: number; // s for one trip up the screen
  delay: number; // s (negative = already mid-flight on load)
  tint: "blue" | "violet" | "orange" | "green";
}[] = [
  { char: "+", left: 6, size: 34, duration: 19, delay: -2, tint: "blue" },
  { char: "×", left: 18, size: 26, duration: 23, delay: -11, tint: "violet" },
  { char: "7", left: 29, size: 30, duration: 21, delay: -6, tint: "orange" },
  { char: "÷", left: 41, size: 28, duration: 25, delay: -16, tint: "green" },
  { char: "9", left: 53, size: 24, duration: 18, delay: -9, tint: "blue" },
  { char: "=", left: 64, size: 32, duration: 22, delay: -3, tint: "violet" },
  { char: "3", left: 75, size: 27, duration: 20, delay: -14, tint: "green" },
  { char: "−", left: 86, size: 36, duration: 24, delay: -7, tint: "orange" },
  { char: "?", left: 94, size: 26, duration: 19, delay: -18, tint: "blue" },
  { char: "5", left: 12, size: 22, duration: 26, delay: -20, tint: "orange" },
  { char: "√", left: 36, size: 30, duration: 27, delay: -1, tint: "violet" },
  { char: "8", left: 58, size: 22, duration: 23, delay: -19, tint: "green" },
  { char: "%", left: 70, size: 24, duration: 28, delay: -12, tint: "blue" },
  { char: "2", left: 90, size: 28, duration: 21, delay: -24, tint: "violet" },
];

export default function GamesBackdrop() {
  return (
    <div className="games-backdrop" aria-hidden="true">
      <span className="games-glow is-a" />
      <span className="games-glow is-b" />
      <span className="games-glow is-c" />
      {GLYPHS.map((glyph, index) => (
        <span
          key={index}
          className={`games-glyph is-${glyph.tint}`}
          style={{
            left: `${glyph.left}%`,
            fontSize: glyph.size,
            animationDuration: `${glyph.duration}s`,
            animationDelay: `${glyph.delay}s`,
          }}
        >
          {glyph.char}
        </span>
      ))}
    </div>
  );
}
