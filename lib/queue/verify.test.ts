import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyQStashRequest } from "./verify";

const ORIGINAL_ENV = { ...process.env };

describe("verifyQStashRequest", () => {
  beforeEach(() => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = "sig_test_current";
    process.env.QSTASH_NEXT_SIGNING_KEY = "sig_test_next";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejects a request with no signature header", async () => {
    const result = await verifyQStashRequest(
      '{"batchId":"x"}',
      null,
      "https://example.com/api/mirror/generate-batch"
    );
    expect(result).toBe(false);
  });

  it("rejects a garbage/tampered signature instead of throwing", async () => {
    const result = await verifyQStashRequest(
      '{"batchId":"x"}',
      "not-a-real-jwt",
      "https://example.com/api/mirror/generate-batch"
    );
    expect(result).toBe(false);
  });

  it("fails closed (returns false, does not throw) when signing keys are unconfigured", async () => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    const result = await verifyQStashRequest(
      '{"batchId":"x"}',
      "some-signature",
      "https://example.com/api/mirror/generate-batch"
    );
    expect(result).toBe(false);
  });
});
