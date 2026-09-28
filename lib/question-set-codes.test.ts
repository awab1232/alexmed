import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  accessCodeHint,
  CODE_ALPHABET,
  CODE_LENGTH,
  formatAccessCode,
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
} from "./question-set-codes";

const KEY = "unit-test-hmac-key-0123456789abcdef-not-a-secret";

describe("access code generation", () => {
  it("makes 12 Crockford base32 symbols (60 bits)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateAccessCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const char of code) expect(CODE_ALPHABET).toContain(char);
    }
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(CODE_ALPHABET).not.toMatch(/[ILOU]/);
  });

  it("maps every byte value onto the alphabet uniformly (low 5 bits)", () => {
    const seen = new Set<string>();
    for (let byte = 0; byte < 256; byte++) {
      seen.add(generateAccessCode(size => new Uint8Array(size).fill(byte))[0]);
    }
    expect(seen.size).toBe(32);
  });

  it("doesn't repeat across a large batch", () => {
    const codes = new Set(
      Array.from({ length: 20_000 }, () => generateAccessCode())
    );
    expect(codes.size).toBe(20_000);
  });

  it("formats for display as NL-XXXX-XXXX-XXXX", () => {
    expect(formatAccessCode("7K9X2P4MQ8RT")).toBe("NL-7K9X-2P4M-Q8RT");
  });
});

describe("normalizeAccessCode", () => {
  it.each([
    ["NL-7K9X-2P4M-Q8RT", "7K9X2P4MQ8RT"],
    ["nl-7k9x-2p4m-q8rt", "7K9X2P4MQ8RT"],
    ["  7K9X 2P4M Q8RT ", "7K9X2P4MQ8RT"],
    ["7k9x2p4mq8rt", "7K9X2P4MQ8RT"],
    // Crockford look-alikes typed by hand: O→0, I/L→1.
    ["NL-7K9X-2P4M-O8RT", "7K9X2P4M08RT"],
    ["7K9X2P4MQ8RI", "7K9X2P4MQ8R1"],
    ["7K9X2P4MQ8RL", "7K9X2P4MQ8R1"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeAccessCode(input)).toBe(expected);
  });

  it.each([
    "",
    "NL-",
    "7K9X-2P4M",
    "7K9X2P4MQ8RT9",
    "7K9X2P4MQ8R!",
    "UUUUUUUUUUUU",
  ])("rejects %j", input => expect(normalizeAccessCode(input)).toBeNull());

  it("gives the last four symbols as the hint", () => {
    expect(accessCodeHint("7K9X2P4MQ8RT")).toBe("Q8RT");
  });
});

describe("hashAccessCode", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.QUESTION_SET_CODE_HMAC_KEY;
    process.env.QUESTION_SET_CODE_HMAC_KEY = KEY;
  });
  afterEach(() => {
    process.env.QUESTION_SET_CODE_HMAC_KEY = saved;
  });

  it("is a stable 64-hex HMAC that doesn't contain the code", () => {
    const hash = hashAccessCode("7K9X2P4MQ8RT");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAccessCode("7K9X2P4MQ8RT")).toBe(hash);
    expect(hash).not.toContain("7K9X");
  });

  it("changes with the key (a stolen table can't be checked without it)", () => {
    const first = hashAccessCode("7K9X2P4MQ8RT");
    process.env.QUESTION_SET_CODE_HMAC_KEY = KEY + "-rotated";
    expect(hashAccessCode("7K9X2P4MQ8RT")).not.toBe(first);
  });

  it("refuses to hash with a missing or short key", () => {
    delete process.env.QUESTION_SET_CODE_HMAC_KEY;
    expect(() => hashAccessCode("7K9X2P4MQ8RT")).toThrow(
      /QUESTION_SET_CODE_HMAC_KEY/
    );
    process.env.QUESTION_SET_CODE_HMAC_KEY = "short";
    expect(() => hashAccessCode("7K9X2P4MQ8RT")).toThrow();
  });
});
