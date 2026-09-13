"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, ListChecks, Plus, Sparkles, User } from "lucide-react";

// Replaces AppSidebar as the persistent student-facing navigation (PR9).
// AppSidebar.tsx is intentionally left in place (unused by student pages
// after this change) rather than deleted — removing a component several
// files still statically import is a bigger, less reversible change than
// simply not rendering it anymore. A later cleanup pass can remove it once
// PR9-PR18 are all verified stable.
//
// "🏠 الرئيسية" points at "/subjects" as of PR10 (the "ملفاتي" folders
// view — see app/subjects/page.tsx). مِرآة itself is unaffected and still
// lives at "/", reachable via app/account/page.tsx's quick links.
const ITEMS = [
  { href: "/subjects", label: "الرئيسية", icon: Home },
  { href: "/books/upload", label: "إضافة", icon: Plus },
  { href: "/assistant", label: "مساعد AI", icon: Sparkles },
  { href: "/account", label: "حسابي", icon: User },
] as const;

// PR17 — "✨ مساعد AI" carries the student's current context automatically
// when they're inside a chapter, book, or folder, per the confirmed
// requirement. app/assistant/page.tsx reads these same params to open the
// right chat.ask scope immediately instead of showing the no-context picker.
export function resolveAssistantHref(pathname: string): string {
  const chapterMatch = pathname.match(/^\/books\/[^/]+\/chapters\/([^/]+)/);
  if (chapterMatch)
    return `/assistant?scope=chapter&chapterId=${chapterMatch[1]}`;

  const bookMatch = pathname.match(/^\/books\/([^/]+)$/);
  if (bookMatch) return `/assistant?scope=book&bookId=${bookMatch[1]}`;

  const subjectMatch = pathname.match(/^\/subjects\/([^/]+)$/);
  if (subjectMatch)
    return `/assistant?scope=subject&subjectId=${subjectMatch[1]}`;

  return "/assistant";
}

// Real upload entry points only — AlexMed has exactly two, already-existing
// flows (كتبي's chaptered book pipeline at /books/upload, and مِرآة's
// simpler question-file-to-flashcards flow at "/"). Deliberately not a
// larger grid: adding cards for capabilities the app doesn't have (voice
// recording, photo solve, ...) would be a stub pretending to work.
const UPLOAD_CHOICES = [
  {
    href: "/books/upload",
    title: "كتاب دراسي",
    description: "فصول، شرح، بطاقات، اختبارات وملخص لكل فصل.",
    icon: BookOpen,
  },
  {
    href: "/",
    title: "ملف أسئلة",
    description: "حوّل ملف أسئلة إلى بطاقات مذاكرة سريعة.",
    icon: ListChecks,
  },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const [chooserOpen, setChooserOpen] = useState(false);

  return (
    <>
      <nav className="student-bottom-nav" aria-label="التنقّل الرئيسي">
        {ITEMS.map(item => {
          const href =
            item.href === "/assistant"
              ? resolveAssistantHref(pathname)
              : item.href;
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;

          // The upload action gets a raised, filled FAB instead of a flat
          // icon+label item — the one thing on this bar a student reaches
          // for constantly (starting a new upload), so it should read as
          // the primary action at a glance instead of blending in as a
          // fourth equal-weight tab. Tapping it opens a chooser (below)
          // rather than jumping straight into one flow.
          if (item.href === "/books/upload") {
            return (
              <button
                key={item.href}
                type="button"
                className="student-bottom-nav-fab-wrap"
                aria-label={item.label}
                aria-haspopup="dialog"
                aria-expanded={chooserOpen}
                onClick={() => setChooserOpen(true)}
              >
                <span className="student-bottom-nav-fab">
                  <Icon size={26} strokeWidth={2.4} />
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={href}
              className={
                active
                  ? "student-bottom-nav-item active"
                  : "student-bottom-nav-item"
              }
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {chooserOpen && (
        <div
          className="upload-chooser-backdrop"
          onClick={() => setChooserOpen(false)}
        >
          <div
            className="upload-chooser-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="ماذا تريد أن ترفع؟"
            onClick={event => event.stopPropagation()}
          >
            <div className="upload-chooser-handle" />
            <h2>ماذا تريد أن ترفع؟</h2>
            {UPLOAD_CHOICES.map(choice => {
              const Icon = choice.icon;
              return (
                <Link
                  key={choice.href}
                  href={choice.href}
                  className="upload-chooser-option"
                  onClick={() => setChooserOpen(false)}
                >
                  <span className="upload-chooser-icon">
                    <Icon size={22} />
                  </span>
                  <span className="upload-chooser-text">
                    <strong>{choice.title}</strong>
                    <span>{choice.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
