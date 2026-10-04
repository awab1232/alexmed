import { NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/db";
import { issueMobileSession } from "@/lib/mobile-session";

// Mobile Google sign-in (blueprint §9, gap G2): the app calls this with
// its Google idToken. Same account rules as the web's Google provider
// (lib/auth.ts): an existing email is linked (never refused) and a suspended
// account is blocked. The response matches /api/mobile/auth/login so the app
// parses both the same way.
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (!idToken) {
    return NextResponse.json(
      { error: "الرمز مفقود.", code: "invalid_token" },
      { status: 400, headers: NO_STORE }
    );
  }

  // Verify idToken with Google
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );
  if (!response.ok) {
    return NextResponse.json(
      { error: "رمز Google غير صالح.", code: "invalid_token" },
      { status: 401, headers: NO_STORE }
    );
  }

  const tokenData = await response.json();

  // Robust Audience & Issuer Verification
  const { aud, iss } = tokenData;
  const isValidAudience = aud === process.env.GOOGLE_CLIENT_ID;
  const isValidIssuer = iss === "https://accounts.google.com" || iss === "accounts.google.com";

  if (!isValidAudience) {
    return NextResponse.json(
      { error: "رمز Google غير صالح.", code: "invalid_token" },
      { status: 401, headers: NO_STORE }
    );
  }

  if (!isValidIssuer) {
    return NextResponse.json(
      { error: "جهة إصدار رمز Google غير صالحة.", code: "invalid_token" },
      { status: 401, headers: NO_STORE }
    );
  }

  const email = tokenData.email as string | undefined;
  // An ID token without a verified email can neither map to nor create an
  // account. Refusing here also stops getUserByEmail(undefined) from matching
  // a phone-only account whose email column is NULL.
  if (!email) {
    return NextResponse.json(
      { error: "لم يصل البريد في الرمز.", code: "invalid_token" },
      { status: 400, headers: NO_STORE }
    );
  }

  const name = tokenData.name as string | undefined;

  // Find or create the user, linking by email as the web's Google provider
  // does. `id` is left to the database (gen_random_uuid()) — users.id is a
  // uuid column and rejects app-generated id strings.
  let user = await getUserByEmail(email);
  if (!user) {
    user = await createUser({
      email,
      name: name ?? null,
      role: "user",
    });
  }

  if (user.suspendedAt) {
    return NextResponse.json(
      { error: "حسابك معلّق.", code: "account_suspended" },
      { status: 403, headers: NO_STORE }
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
  return NextResponse.json(
    {
      ...fresh,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
    { headers: NO_STORE }
  );
}
