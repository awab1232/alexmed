import { NextResponse, type NextRequest } from "next/server";
import { canonicalHostRedirect } from "@/lib/canonical-host";

// "/" is two pages: the public landing page for visitors and the app home
// for signed-in students. They live in separate routes so the landing page
// ships only its own small CSS, not the app stylesheet the home needs.
// With a session cookie, "/" is served from /home (the URL stays "/");
// /home itself re-checks the session and falls back to the landing page.
// Only a cookie check here — no auth work on the edge.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(request: NextRequest) {
  const canonicalUrl = canonicalHostRedirect(request.nextUrl);
  if (canonicalUrl) return NextResponse.redirect(canonicalUrl, 308);
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  const signedIn = request.cookies
    .getAll()
    .some(cookie =>
      SESSION_COOKIES.some(
        name => cookie.name === name || cookie.name.startsWith(`${name}.`)
      )
    );
  if (!signedIn) return NextResponse.next();
  return NextResponse.rewrite(new URL("/subjects", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
