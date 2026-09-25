import BottomNav from "@/components/BottomNav";
import GamesBackdrop from "@/components/brain-games/GamesBackdrop";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// 🧠 Brain Games shell — same auth check + BottomNav as app/subjects.
export default async function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="app-shell games-shell">
      <GamesBackdrop />
      <main className="main-content">{children}</main>
      <BottomNav />
    </div>
  );
}
