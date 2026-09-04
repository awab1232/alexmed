import AppSidebar from "@/components/AppSidebar";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Shared shell for the whole كتبي section — one auth check for every /books/*
// page, and the same unified sidebar (مِرآة group + كتبي group) the user
// approved in the design demo. Reuses the exact app-shell/main-content
// classes components/Home.tsx already uses (app/globals.css), so both
// halves of the app share one visual shell without sharing React state.
export default async function BooksLayout({
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
