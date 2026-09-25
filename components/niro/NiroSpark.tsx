import { useId } from "react";

// ✨ Niro Spark — Niro's signature mark: a small four-point spark of
// cyan→electric-blue light with a lime core (understanding, curiosity,
// progress, achievement). Used on his hoodie, by his hand when explaining,
// on the bottom-nav avatar when active, and for thinking / level-up.
//   motion: "none" | "glow" (gentle pulse) | "think" (turning pulse while
//   AI works) | "burst" (one short pop for achievements).
// All motion is CSS (.niro-spark-*), disabled under prefers-reduced-motion.
export default function NiroSpark({
  size = 16,
  motion = "none",
  className,
  title,
}: {
  size?: number;
  motion?: "none" | "glow" | "think" | "burst";
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`niro-spark niro-spark-${motion}${className ? ` ${className}` : ""}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <radialGradient id={`${id}-h`}>
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.55" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#${id}-h)`} />
      <path
        d="M12 1.5c.9 5.4 3.3 8 8.6 10.5-5.3 2.5-7.7 5.1-8.6 10.5-.9-5.4-3.3-8-8.6-10.5C8.7 9.5 11.1 6.9 12 1.5Z"
        fill={`url(#${id}-g)`}
      />
      <circle cx="12" cy="12" r="2.1" fill="#d9f99d" />
    </svg>
  );
}
