"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

// Next.js App Router convention file — catches any render/runtime error
// thrown inside a page (or its layout, other than the root one) that isn't
// caught locally, and shows this instead of Next's default behavior for an
// uncaught client error in production: a blank white page with nothing on
// it. There was no error.tsx/global-error.tsx anywhere in the app before
// this, so every one of those blank-screen reports was this exact gap.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <section className="upload-view">
      <div className="empty-state">
        <TriangleAlert size={28} />
        <h3>حدث خطأ غير متوقع</h3>
        <p>الصفحة ما قدرت تكمل تحميلها. جرّب مرة ثانية.</p>
        <button
          type="button"
          className="secondary-button"
          style={{ marginTop: 14 }}
          onClick={reset}
        >
          <RotateCcw size={16} /> إعادة المحاولة
        </button>
      </div>
    </section>
  );
}
