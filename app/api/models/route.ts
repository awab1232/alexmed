import { listOpenRouterModels } from "@/lib/llm";
import { NextResponse } from "next/server";

export async function GET() {
  const models = await listOpenRouterModels();
  return NextResponse.json({ models });
}
