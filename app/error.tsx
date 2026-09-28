"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import s from "./status.module.css";

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
    <main className={`${s.screen} ${s.inline}`}>
      <div className={s.panel}>
        <span className={s.icon}>
          <TriangleAlert size={28} aria-hidden="true" />
        </span>
        <h1 className={s.title}>حدث خطأ غير متوقع</h1>
        <p className={s.text}>الصفحة ما قدرت تكمل تحميلها. جرّب مرة ثانية.</p>
        <button type="button" className={s.action} onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" /> إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
