import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/credentials-login";
import { issueMobileSession } from "@/lib/mobile-session";

// Native app sign-in (docs/mobile/MOBILE_ARCHITECTURE_BLUEPRINT.md §9, gap
// G1). Same check as the web's Credentials provider (lib/credentials-login.ts:
// rate limit, suspended accounts, bcrypt); on success returns the Auth.js
// session token the app then sends as the session cookie. Nothing about web
// sign-in changes.
const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(320),
  // bcrypt only uses the first 72 bytes; the cap stops huge inputs early.
  password: z.string().min(1).max(128),
});

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "أدخل رقم الهاتف (أو البريد) وكلمة المرور.", code: "bad_request" },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await verifyCredentials(parsed.data);
  if (!result.ok) {
    // Same wording as the web login form (components/LoginForm.tsx).
    switch (result.reason) {
      case "too_many_attempts":
        return NextResponse.json(
          {
            error: "محاولات دخول كثيرة. حاول بعد شوي.",
            code: "too_many_attempts",
          },
          { status: 429, headers: NO_STORE }
        );
      case "suspended":
        return NextResponse.json(
          {
            error:
              "حسابك معلّق حاليًا. تواصل مع الدعم إذا كنت تظن أن هذا خطأ.",
            code: "account_suspended",
          },
          { status: 403, headers: NO_STORE }
        );
      default:
        return NextResponse.json(
          {
            error: "رقم الهاتف (أو البريد) أو كلمة المرور غير صحيحة.",
            code: "invalid_credentials",
          },
          { status: 401, headers: NO_STORE }
        );
    }
  }

  const session = await issueMobileSession(result.user, request.url);
  return NextResponse.json(
    {
      ...session,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    },
    { headers: NO_STORE }
  );
}
