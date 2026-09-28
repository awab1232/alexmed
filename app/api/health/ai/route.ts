import { checkAiHealth } from "@/lib/ai/health";
import { getAiLoadSnapshot } from "@/lib/ai/metrics";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Server-side only — never the API key or any provider internals. Anyone
// (e.g. a deploy health check) gets reachability via the status code and
// { ok }; which provider is active — and the AI load snapshot (queue depth,
// oldest waiting job, recent failures by type, open circuits) — is shown to
// admins only.
export async function GET() {
  const health = await checkAiHealth();
  const session = await auth();
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "admin";
  if (!isAdmin) {
    return NextResponse.json(
      { ok: health.ok },
      { status: health.ok ? 200 : 503 }
    );
  }
  let load = null;
  try {
    load = await getAiLoadSnapshot();
  } catch (error) {
    console.error("[Health] AI load snapshot failed", error);
  }
  return NextResponse.json(
    { ...health, load },
    { status: health.ok ? 200 : 503 }
  );
}
