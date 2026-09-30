import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { issueMobileSession } from "@/lib/mobile-session";

// Native app session refresh (blueprint §9, gap G4): the app calls this with
// its current session cookie while it still has days left and gets a fresh
// 30-day token. `auth()` validates the current token exactly as for the web
// (expiry, and the per-request database re-check that ends sessions of
// suspended or deleted accounts), so a refresh can never revive a session
// the server has already ended.
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "انتهت الجلسة. سجّل الدخول مرة أخرى.", code: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }

  const user = await getUserById(userId);
  if (!user || user.suspendedAt) {
    return NextResponse.json(
      { error: "انتهت الجلسة. سجّل الدخول مرة أخرى.", code: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }

  const fresh = await issueMobileSession(
    {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role,
    },
    request.url
  );
  return NextResponse.json(fresh, { headers: NO_STORE });
}
