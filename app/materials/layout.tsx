import "@/app/globals.css";
import BottomNav from "@/components/BottomNav";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Shared shell for /materials/* (مكتبة الأدمن, reader side). 🔒 Admins only,
// checked on the server for every page under it — typing the URL as a
// student redirects home; nothing renders first. The tRPC router behind it
// (lib/trpc/studentMaterialsRouter.ts) enforces the same rule.
export const dynamic = "force-dynamic";

export default async function MaterialsLayout({
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
      <main className="main-content">{children}</main>
      <BottomNav />
    </div>
  );
}
