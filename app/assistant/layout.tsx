import BottomNav from "@/components/BottomNav";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Same auth guard + shell pattern as app/books/layout.tsx, but with
// BottomNav instead of AppSidebar — this route only exists after PR9.
export default async function AssistantLayout({
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
      {/* Full-bleed, ChatGPT-style chat: the page itself fills the screen. */}
      <main className="main-content assistant-main">{children}</main>
      <BottomNav />
    </div>
  );
}
