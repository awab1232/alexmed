"use client";

import { useEffect } from "react";

// Next.js App Router convention file — the one fallback for an error thrown
// by the ROOT layout itself (app/error.tsx can't catch that, since the
// layout that would render it is what crashed). Must render its own
// <html>/<body> since the real root layout is what's being replaced. Kept
// intentionally plain (no globals.css classes) so it still renders even if
// the crash was CSS/theme-related.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          fontFamily: "sans-serif",
          background: "#f5f0e8",
          color: "#202c32",
        }}
      >
        <h2 style={{ margin: 0 }}>حدث خطأ غير متوقع</h2>
        <p style={{ margin: 0, color: "#758087" }}>
          التطبيق ما قدر يفتح. جرّب مرة ثانية.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 22px",
            borderRadius: 10,
            border: "1px solid #ded8cf",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
