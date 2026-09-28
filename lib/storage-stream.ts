import { NextResponse } from "next/server";
import { storageGetSignedUrl } from "./storage";

// Same-origin byte-range proxy for one stored object: the signed storage URL
// is fetched here, on the server, and never reaches the browser. Used by
// /api/files/[...key]'s ?stream=1 mode (the PDF reader) and by protected
// content, where handing a viewer a signed URL would give them a link that
// keeps working for anyone it's passed to until it expires.
//
// Call only AFTER the caller has been authorized for relKey.
export async function streamStoredObject(
  relKey: string,
  request: Request,
  options: { cacheControl: string }
): Promise<Response> {
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
      "Cache-Control": options.cacheControl,
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
