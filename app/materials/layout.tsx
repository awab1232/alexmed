import AppSidebar from "@/components/AppSidebar";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Shared shell for /materials/* (مكتبة الأدمن, student-facing side) — same
// pattern as app/books/layout.tsx: one auth check for the whole section, any
// logged-in user (not admin-only — see app/admin/layout.tsx for that gate).
export default async function MaterialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
