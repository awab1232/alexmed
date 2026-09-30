import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

// Verifies a Google ID token from the native app's Google Sign-In
// (docs/mobile/MOBILE_ARCHITECTURE_BLUEPRINT.md §9, gap G2) — with Node's
// own crypto against Google's published keys, so no new dependency.
//
// On Android the app asks Google for a token meant for a *web* OAuth client
// (serverClientId) in the same Google Cloud project as its Android client, so
// `aud` is that web client and `azp` is the Android client that asked for it.
// Both are checked.

export const GOOGLE_ISSUERS = [
  "accounts.google.com",
  "https://accounts.google.com",
];
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const CLOCK_SKEW_SECONDS = 60;

export type GoogleIdClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  azp: string | null;
};

export class GoogleTokenError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid Google ID token: ${reason}`);
  }
}

type Jwk = JsonWebKey & { kid?: string; alg?: string };
type JwksFetcher = () => Promise<{ keys: Jwk[]; maxAgeSeconds: number }>;

async function fetchGoogleJwks(): Promise<{
  keys: Jwk[];
  maxAgeSeconds: number;
}> {
  const response = await fetch(GOOGLE_JWKS_URL, { cache: "no-store" });
  if (!response.ok)
    throw new Error(`Google keys unavailable (${response.status})`);
  const body = (await response.json()) as { keys?: Jwk[] };
  const maxAge = /max-age=(\d+)/.exec(
    response.headers.get("cache-control") ?? ""
  );
  return {
    keys: body.keys ?? [],
    maxAgeSeconds: maxAge ? Number(maxAge[1]) : 3600,
  };
}

// Keys are cached for as long as Google says (Cache-Control max-age); an
// unknown key id refetches once (Google rotates keys).
let cached: { keys: Jwk[]; expiresAt: number } | null = null;

async function keyFor(
  kid: string,
  fetchJwks: JwksFetcher,
  nowMs: number
): Promise<Jwk> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!cached || cached.expiresAt <= nowMs || attempt === 1) {
      const { keys, maxAgeSeconds } = await fetchJwks();
      cached = { keys, expiresAt: nowMs + maxAgeSeconds * 1000 };
    }
    const key = cached.keys.find(k => k.kid === kid);
    if (key) return key;
  }
  throw new GoogleTokenError("unknown signing key");
}

/** For tests. */
export function resetGoogleKeyCache() {
  cached = null;
}

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    throw new GoogleTokenError("malformed");
  }
}

export async function verifyGoogleIdToken(
  idToken: string,
  options: {
    /** Web OAuth client IDs the token may be meant for (its audience). */
    audiences: string[];
    /** OAuth clients allowed to have requested it (the Android client). */
    authorizedParties: string[];
    now?: Date;
    fetchJwks?: JwksFetcher;
  }
): Promise<GoogleIdClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new GoogleTokenError("malformed");
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeSegment(headerB64);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new GoogleTokenError("unsupported algorithm");
  }

  const nowMs = (options.now ?? new Date()).getTime();
  const jwk = await keyFor(
    header.kid,
    options.fetchJwks ?? fetchGoogleJwks,
    nowMs
  );
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signedOk = verify(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, "base64url")
  );
  if (!signedOk) throw new GoogleTokenError("bad signature");

  const claims = decodeSegment(payloadB64);
  const now = nowMs / 1000;
  if (!GOOGLE_ISSUERS.includes(String(claims.iss))) {
    throw new GoogleTokenError("wrong issuer");
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some(a => options.audiences.includes(String(a))))
    throw new GoogleTokenError("wrong audience");
  const azp = typeof claims.azp === "string" ? claims.azp : null;
  if (
    azp !== null &&
    !options.audiences.includes(azp) &&
    !options.authorizedParties.includes(azp)
  ) {
    throw new GoogleTokenError("unknown client");
  }
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS < now) {
    throw new GoogleTokenError("expired");
  }
  if (typeof claims.iat === "number" && claims.iat - CLOCK_SKEW_SECONDS > now) {
    throw new GoogleTokenError("issued in the future");
  }
  if (typeof claims.sub !== "string" || !claims.sub) {
    throw new GoogleTokenError("no subject");
  }
  if (typeof claims.email !== "string" || !claims.email) {
    throw new GoogleTokenError("no email");
  }
  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified:
      claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
    azp,
  };
}
