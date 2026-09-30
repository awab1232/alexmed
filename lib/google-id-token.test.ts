import { generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GoogleTokenError,
  resetGoogleKeyCache,
  verifyGoogleIdToken,
} from "./google-id-token";

const WEB = "web-client.apps.googleusercontent.com";
const ANDROID = "android-client.apps.googleusercontent.com";
const NOW = new Date("2026-10-01T10:00:00Z");
const now = Math.floor(NOW.getTime() / 1000);

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256" };
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

function token(
  claims: Record<string, unknown>,
  { kid = "k1", key = privateKey, alg = "RS256" } = {}
) {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg, kid, typ: "JWT" });
  const body = enc(claims);
  const sig = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString(
    "base64url"
  );
  return `${head}.${body}.${sig}`;
}

const good = {
  iss: "https://accounts.google.com",
  aud: WEB,
  azp: ANDROID,
  sub: "1234567890",
  email: "student@gmail.com",
  email_verified: true,
  name: "Student One",
  picture: "https://lh3.googleusercontent.com/a/x",
  iat: now - 10,
  exp: now + 3600,
};

const fetchJwks = vi.fn(async () => ({ keys: [jwk], maxAgeSeconds: 3600 }));
const verifyWith = (t: string) =>
  verifyGoogleIdToken(t, {
    audience: WEB,
    authorizedParties: [ANDROID],
    now: NOW,
    fetchJwks,
  });

beforeEach(() => {
  resetGoogleKeyCache();
  fetchJwks.mockClear();
});

describe("verifyGoogleIdToken", () => {
  it("accepts a token for the web audience requested by the Android client", async () => {
    const claims = await verifyWith(token(good));
    expect(claims).toEqual({
      sub: "1234567890",
      email: "student@gmail.com",
      emailVerified: true,
      name: "Student One",
      picture: "https://lh3.googleusercontent.com/a/x",
      azp: ANDROID,
    });
  });

  it("caches Google's keys", async () => {
    await verifyWith(token(good));
    await verifyWith(token(good));
    expect(fetchJwks).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong audience", { aud: "someone-else" }],
    ["unknown client", { azp: "evil.apps.googleusercontent.com" }],
    ["wrong issuer", { iss: "https://evil.example" }],
    ["expired", { exp: now - 3600 }],
    ["issued in the future", { iat: now + 3600 }],
    ["no email", { email: undefined }],
    ["no subject", { sub: "" }],
  ])("rejects: %s", async (reason, patch) => {
    await expect(verifyWith(token({ ...good, ...patch }))).rejects.toThrow(
      new GoogleTokenError(reason)
    );
  });

  it("rejects a token signed with another key", async () => {
    await expect(
      verifyWith(token(good, { key: other.privateKey }))
    ).rejects.toThrow("bad signature");
  });

  it("rejects a tampered payload", async () => {
    const [h, , s] = token(good).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...good, email: "admin@x.com" })
    ).toString("base64url");
    await expect(verifyWith(`${h}.${forged}.${s}`)).rejects.toThrow(
      "bad signature"
    );
  });

  it("rejects a non-RS256 token", async () => {
    await expect(verifyWith(token(good, { alg: "HS256" }))).rejects.toThrow(
      "unsupported algorithm"
    );
  });

  it("refetches once for an unknown key id, then rejects", async () => {
    await expect(verifyWith(token(good, { kid: "rotated" }))).rejects.toThrow(
      "unknown signing key"
    );
    expect(fetchJwks).toHaveBeenCalledTimes(2);
  });

  it("reports an unverified email without rejecting", async () => {
    const claims = await verifyWith(token({ ...good, email_verified: false }));
    expect(claims.emailVerified).toBe(false);
  });

  it("rejects garbage", async () => {
    await expect(verifyWith("not.a.jwt")).rejects.toBeInstanceOf(
      GoogleTokenError
    );
    await expect(verifyWith("abc")).rejects.toThrow("malformed");
  });
});
