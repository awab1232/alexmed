"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowUp,
  BarChart3,
  BookOpen,
  CircleAlert,
  ClipboardList,
  Home,
  Layers3,
  Library,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";

type MiratView = "upload" | "cards" | "library";

export type AppSidebarProps = {
  // مِرآة group — pass these only when rendering inside the مِرآة page itself
  // (components/Home.tsx, via onMiratNavigate). On /books/* pages these are
  // omitted, and the مِرآة items become plain links back to "/" instead of
  // view-state buttons — there's no Home.tsx state to control from outside it.
  activeMiratView?: MiratView;
  miratCardsCount?: number;
  miratReviewCount?: number;
  onMiratNavigate?: (
    view: MiratView,
    options?: { onlyReview?: boolean }
  ) => void;
};

function MiratNavLink({
  href,
  onClick,
  active,
  disabled,
  children,
}: {
  href: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className = active ? "nav-item active" : "nav-item";
  if (onClick) {
    return (
      <button className={className} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function AppSidebar({
  activeMiratView,
  miratCardsCount = 0,
  miratReviewCount = 0,
  onMiratNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const accountName = session?.user?.name || session?.user?.email || "";
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "؟";

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <BookOpen size={20} strokeWidth={2.4} />
        </div>
        <div>
          <strong>مِرآة</strong>
          <span>study cards</span>
        </div>
      </div>
      <div className="side-rule" />
      <p className="side-label">مِرآة</p>
      <nav className="side-nav">
        <MiratNavLink
          href="/"
          active={activeMiratView === "upload"}
          onClick={
            onMiratNavigate ? () => onMiratNavigate("upload") : undefined
          }
        >
          <Upload size={17} />
          <span>رفع ملف جديد</span>
          <ArrowUp size={14} className="nav-arrow" />
        </MiratNavLink>
        <MiratNavLink
          href="/"
          active={activeMiratView === "cards"}
          disabled={onMiratNavigate ? !miratCardsCount : false}
          onClick={onMiratNavigate ? () => onMiratNavigate("cards") : undefined}
        >
          <Layers3 size={17} />
          <span>بطاقاتي</span>
          <b>{miratCardsCount || "—"}</b>
        </MiratNavLink>
        <MiratNavLink
          href="/"
          disabled={onMiratNavigate ? !miratCardsCount : false}
          onClick={
            onMiratNavigate
              ? () => onMiratNavigate("cards", { onlyReview: true })
              : undefined
          }
        >
          <CircleAlert size={17} />
          <span>تحتاج مراجعة</span>
          <b className="review-count">{miratReviewCount || "—"}</b>
        </MiratNavLink>
        <MiratNavLink
          href="/"
          active={activeMiratView === "library"}
          onClick={
            onMiratNavigate ? () => onMiratNavigate("library") : undefined
          }
        >
          <Library size={17} />
          <span>مكتبتي</span>
        </MiratNavLink>
      </nav>

      <div className="side-rule" />
      <p className="side-label">كتبي</p>
      <nav className="side-nav">
        <Link
          href="/books"
          className={pathname === "/books" ? "nav-item active" : "nav-item"}
        >
          <Home size={17} />
          <span>الرئيسية</span>
        </Link>
        <Link
          href="/books/upload"
          className={
            pathname === "/books/upload" ? "nav-item active" : "nav-item"
          }
        >
          <Upload size={17} />
          <span>رفع كتاب جديد</span>
        </Link>
        <Link
          href="/books/review"
          className={
            pathname === "/books/review" ? "nav-item active" : "nav-item"
          }
        >
          <RotateCcw size={17} />
          <span>المراجعة اليومية</span>
        </Link>
        <Link
          href="/books/quizzes"
          className={
            pathname === "/books/quizzes" ? "nav-item active" : "nav-item"
          }
        >
          <ClipboardList size={17} />
          <span>اختباراتي</span>
        </Link>
        <Link
          href="/books/stats"
          className={
            pathname === "/books/stats" ? "nav-item active" : "nav-item"
          }
        >
          <BarChart3 size={17} />
          <span>إحصائياتي</span>
        </Link>
      </nav>

      <div className="sidebar-bottom">
        {session?.user && (
          <div className="sidebar-account">
            <div className="sidebar-account-avatar">{accountInitial}</div>
            <div className="sidebar-account-info">
              <strong>{session.user.name || "حسابي"}</strong>
              <span>{session.user.email}</span>
            </div>
            <button
              type="button"
              className="sidebar-account-logout"
              title="تسجيل الخروج"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
        <div className="mini-privacy">
          <ShieldCheck size={16} />
          <span>
            ملفاتك للدراسة فقط
            <br />
            <small>وتُحلّل أثناء الجلسة</small>
          </span>
        </div>
        <div className="side-footer">PDF → فهم → تذكّر</div>
      </div>
    </aside>
  );
}
