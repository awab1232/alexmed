import { ImageResponse } from "next/og";

// Home-screen icon (iOS needs a PNG): the Niro Spark on ink, like icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1b2340",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#67e8f9" />
              <stop offset="1" stopColor="#3355ff" />
            </linearGradient>
          </defs>
          <path
            d="M32 8c2.2 13 8 19.3 20.8 25.4C40 39.4 34.2 45.7 32 58.7 29.8 45.7 24 39.4 11.2 33.4 24 27.3 29.8 21 32 8Z"
            fill="url(#g)"
          />
          <circle cx="32" cy="33.4" r="5" fill="#d9f99d" />
        </svg>
      </div>
    ),
    size
  );
}
