import { checkAiHealth } from "@/lib/ai/health";
import { NextResponse } from "next/server";

// Server-side only — returns reachability + which provider is active, never
// the API key or any provider internals.
export async function GET() {
  const health = await checkAiHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
