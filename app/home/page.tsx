import "@/app/globals.css";
import Home from "@/components/Home";
import Landing from "@/components/landing/Landing";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";

// The signed-in app home. Served at "/" through middleware.ts (a rewrite
// when a session cookie is present), so students never see "/home" in the
// address bar. Kept out of the index; "/" is the canonical page.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
};

export default async function AppHomePage() {
  const session = await auth();
  // A stale or invalid cookie: show the public landing page, as "/" would.
  if (!session?.user) return <Landing />;
  return <Home />;
}
