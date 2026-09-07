import AppSidebar from "@/components/AppSidebar";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Server-side gate for the whole /admin/* section — defense in depth on top
// of every adminProcedure/admin API route check (never the only check: a
// student who somehow reached a URL under /admin would still be rejected by
// every mutation/query behind it). Redirects unauthenticated users to
// /login (same as app/books/layout.tsx) and non-admins to "/" — never
// renders admin content, even a loading shell, for a non-admin session.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
