import { checkAiHealth } from "@/lib/ai/health";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Server-side only — never the API key or any provider internals. Anyone
// (e.g. a deploy health check) gets reachability via the status code and
// { ok }; which provider is active is shown to admins only.
export async function GET() {
  const health = await checkAiHealth();
  const session = await auth();
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "admin";
  return NextResponse.json(isAdmin ? health : { ok: health.ok }, {
    status: health.ok ? 200 : 503,
  });
}
