import { auth } from "@/lib/auth";
import { isFileKeyAccessibleToUser } from "@/lib/db-file-access";
import { storageGetSignedUrl } from "@/lib/storage";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const relKey = key.join("/");

  if (!relKey) {
    return NextResponse.json({ error: "Missing storage key" }, { status: 400 });
  }

  // Ownership check — a raw key alone proves nothing; verify it belongs to
  // a resource this user may read before ever signing a URL for it. Returns
  // 404 (not 403) so an unauthorized guess can't distinguish "not yours"
  // from "doesn't exist".
  const allowed = await isFileKeyAccessibleToUser(session.user.id, relKey);
  if (!allowed) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // ?stream=1 — same-origin byte-range proxy for the PDF reader. Storage
  // answers Range requests (206) but without CORS headers, so the browser
  // can't make them against the signed URL directly; the reader therefore
  // had to download the WHOLE file before showing page 1 (a 50MB scanned
  // PDF looked stuck on "جاري تحميل" for minutes). Proxying keeps the
  // request same-origin, so pdf.js can fetch only the bytes it needs.
  if (new URL(request.url).searchParams.get("stream") === "1") {
    try {
      const url = await storageGetSignedUrl(relKey);
      const range = request.headers.get("range");
      const upstream = await fetch(url, {
        headers: range ? { Range: range } : undefined,
        signal: request.signal,
      });
      if (!upstream.ok || !upstream.body) {
        console.error("[Files] Storage stream failed:", upstream.status);
        return NextResponse.json({ error: "Storage error" }, { status: 502 });
      }
      const headers = new Headers({
        "Content-Type":
          upstream.headers.get("content-type") || "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      });
      for (const name of ["content-length", "content-range", "etag"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("[Files] Failed to stream from storage:", error);
      return NextResponse.json({ error: "Storage error" }, { status: 502 });
    }
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
