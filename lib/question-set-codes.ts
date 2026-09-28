// Access codes for protected question sets.
//
//   display:  NL-7K9X-2P4M-Q8RT
//   stored:   HMAC-SHA256(QUESTION_SET_CODE_HMAC_KEY, "7K9X2P4MQ8RT")
//
// 12 symbols of Crockford base32 = 60 bits of randomness, so guessing a live
// code is hopeless even with many thousands of codes outstanding (and
// redeem attempts are rate limited on top). The plaintext exists only in
// the response that generated it; the database keeps the keyed hash and the
// last 4 symbols (so a doctor can find a code without it being readable).
import { createHmac, randomBytes } from "node:crypto";

// Crockford base32: no I, L, O or U, so a code read aloud or retyped from
// paper can't be confused.
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 12;
const DISPLAY_PREFIX = "NL";

export class AccessCodeKeyMissingError extends Error {
  constructor() {
    super("QUESTION_SET_CODE_HMAC_KEY is not configured");
    this.name = "AccessCodeKeyMissingError";
  }
}

// 32 symbols = 5 bits, so the low 5 bits of each random byte are uniform.
export function generateAccessCode(
  random: (size: number) => Uint8Array = randomBytes
): string {
  const bytes = random(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] & 31];
  return code;
}

export function formatAccessCode(code: string): string {
  return `${DISPLAY_PREFIX}-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

// What a student typed → the 12 canonical symbols, or null. Accepts the
// display form with or without the NL- prefix, any case, spaces or dashes,
// and the usual Crockford look-alikes (O→0, I/L→1).
export function normalizeAccessCode(input: string): string | null {
  let text = input.toUpperCase().replace(/[\s\-_]/g, "");
  // The prefix is stripped before look-alike mapping (its L would map to 1)
  // and only when the rest is a full code, since codes never contain L.
  if (text.length === CODE_LENGTH + 2 && text.startsWith(DISPLAY_PREFIX)) {
    text = text.slice(2);
  }
  if (text.length !== CODE_LENGTH) return null;
  text = text.replace(/O/g, "0").replace(/[IL]/g, "1");
  for (const char of text) {
    if (!CODE_ALPHABET.includes(char)) return null;
  }
  return text;
}

function hmacKey(): string {
  const key = process.env.QUESTION_SET_CODE_HMAC_KEY ?? "";
  if (key.length < 32) throw new AccessCodeKeyMissingError();
  return key;
}

export function hashAccessCode(normalized: string): string {
  return createHmac("sha256", hmacKey()).update(normalized).digest("hex");
}

// Throws AccessCodeKeyMissingError early (before any work) when the key
// isn't configured.
export function assertAccessCodeKeyConfigured() {
  hmacKey();
}

export function accessCodeHint(normalized: string): string {
  return normalized.slice(-4);
}
