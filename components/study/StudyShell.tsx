"use client";

import { useEffect, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// Shared full-screen frame for the chapter study modes (الاختبار / البطاقات /
// الملخص): a fixed shell over the whole viewport (covering BottomNav, same
// approach as the PDF reader — see .pdf-reader-page), with an iOS-style
// header: back chevron on the start side, title, then optional actions.
export default function StudyShell({
  title,
  subtitle,
  onBack,
  actions,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // The page underneath shouldn't scroll/rubber-band behind the shell.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="study-shell" role="dialog" aria-modal="true">
      <header className="study-shell-header">
        <button
          type="button"
          className="study-shell-back"
          onClick={onBack}
          aria-label="رجوع"
        >
          <ChevronRight size={26} />
        </button>
        <div className="study-shell-title">
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </div>
        <div className="study-shell-actions">{actions}</div>
      </header>
      <div className="study-shell-body">{children}</div>
      {footer && <div className="study-shell-footer">{footer}</div>}
    </div>
  );
}
