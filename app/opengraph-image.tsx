import { ImageResponse } from "next/og";

// Link-preview image. The renderer (satori) can't shape Arabic script, so
// the image carries the brand and an English line; the Arabic title and
// description travel in the page's og:title / og:description.
export const alt = "NiroLearn — منصة دراسة بالذكاء الاصطناعي";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f2f4f9",
          color: "#1b2340",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#67e8f9" />
                <stop offset="1" stopColor="#3355ff" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="#1b2340" />
            <path
              d="M32 8c2.2 13 8 19.3 20.8 25.4C40 39.4 34.2 45.7 32 58.7 29.8 45.7 24 39.4 11.2 33.4 24 27.3 29.8 21 32 8Z"
              fill="url(#g)"
            />
            <circle cx="32" cy="33.4" r="5" fill="#d9f99d" />
          </svg>
          <span style={{ fontSize: 56, fontWeight: 700 }}>NiroLearn</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            Turn your books and lectures into
          </div>
          <div style={{ display: "flex" }}>
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.15,
                padding: "0 12px",
                background: "#ffd43b",
              }}
            >
              exam-ready study.
            </span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#454c66" }}>
          Summaries · Exam Focus · Flashcards · Quizzes · Mind maps
        </div>
      </div>
    ),
    size
  );
}
