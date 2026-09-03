import { storageGetSignedUrl } from "@/lib/storage";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const relKey = key.join("/");

  if (!relKey) {
    return NextResponse.json({ error: "Missing storage key" }, { status: 400 });
  }

  try {
    const url = await storageGetSignedUrl(relKey);
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Files] Failed to sign storage URL:", error);
    return NextResponse.json({ error: "Storage error" }, { status: 502 });
  }
}
