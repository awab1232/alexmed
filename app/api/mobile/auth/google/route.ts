import { NextResponse } from "next/server";
import { getUserById, getUserByEmail, createUser } from "@/lib/db";
import { issueMobileSession } from "@/lib/mobile-session";
import { nanoid } from "nanoid";

// Mobile Google sign-in (blueprint §9, gap G2): the app calls this with
// its Google idToken.
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (!idToken) {
    return NextResponse.json(
      { error: "Token missing", code: "invalid_token" },
      { status: 400, headers: NO_STORE }
    );
  }

  // Verify idToken with Google
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );
  if (!response.ok) {
    return NextResponse.json(
      { error: "Invalid token", code: "invalid_token" },
      { status: 401, headers: NO_STORE }
    );
  }

  const tokenData = await response.json();

  // Verify audience
  if (tokenData.aud !== process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Invalid audience", code: "invalid_token" },
      { status: 401, headers: NO_STORE }
    );
  }

  const { email, name, sub: googleId } = tokenData;

  // Find or create user
  let user = await getUserByEmail(email);
  if (!user) {
    // Create new user if not exists
    user = await createUser({
        id: nanoid(),
        email,
        name,
        role: "user",
        // No password for Google users
    });
  }

  if (user.suspendedAt) {
    return NextResponse.json(
      { error: "حسابك معلّق.", code: "account_suspended" },
      { status: 401, headers: NO_STORE }
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
  return NextResponse.json(fresh, { headers: NO_STORE });
}
