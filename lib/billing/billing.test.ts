// Pure billing helpers — prices, local-currency display, periods, dates.
// The database paths are covered by billing.integration.test.ts (LIVE_DB=1).
import { describe, expect, it } from "vitest";
import {
  formatPrice,
  guessCountry,
  localEquivalent,
  maxFileSizeBytes,
  planHasFeature,
  type PlanConfig,
} from "./catalog";
import { periodKeys } from "./periods";
import { addMonths } from "./subscriptions";

const RATES = { JOD: 0.709, SAR: 3.75, EGP: 48.5 };

describe("formatPrice", () => {
  it("formats whole and fractional USD amounts", () => {
    expect(formatPrice(1000)).toBe("$10");
    expect(formatPrice(2000, "USD")).toBe("$20");
    expect(formatPrice(999)).toBe("$9.99");
  });
});

describe("guessCountry", () => {
  it("prefers the phone dial code", () => {
    expect(
      guessCountry({ phone: "+962791234567", timeZone: "Asia/Riyadh" })
    ).toBe("JO");
    expect(guessCountry({ phone: "+966501234567" })).toBe("SA");
  });

  it("falls back to the timezone, else null", () => {
    expect(guessCountry({ phone: null, timeZone: "Asia/Amman" })).toBe("JO");
    expect(guessCountry({ timeZone: "Pacific/Nowhere" })).toBeNull();
    expect(guessCountry({})).toBeNull();
  });
});

describe("localEquivalent", () => {
  it("shows the $10 / $20 equivalent in the student's currency", () => {
    expect(localEquivalent(1000, "JO", RATES)).toBe("≈ 7.09 د.أ");
    expect(localEquivalent(2000, "SA", RATES)).toBe("≈ 75 ر.س");
  });

  it("shows nothing for free plans, unknown countries or missing rates", () => {
    expect(localEquivalent(0, "JO", RATES)).toBeNull();
    expect(localEquivalent(1000, null, RATES)).toBeNull();
    expect(localEquivalent(1000, "US", RATES)).toBeNull();
    expect(localEquivalent(1000, "KW", RATES)).toBeNull();
  });
});

describe("plan helpers", () => {
  const plan = {
    maxFileSizeMb: 100,
    features: { MIND_MAP: true, PRIORITY_PROCESSING: false },
  } as unknown as PlanConfig;

  it("converts the MB limit to bytes", () => {
    expect(maxFileSizeBytes(plan)).toBe(100 * 1024 * 1024);
  });

  it("only treats features explicitly set to true as included", () => {
    expect(planHasFeature(plan, "MIND_MAP")).toBe(true);
    expect(planHasFeature(plan, "PRIORITY_PROCESSING")).toBe(false);
    expect(planHasFeature(plan, "LARGE_FILES")).toBe(false);
  });
});

describe("periodKeys (Asia/Amman, UTC+3)", () => {
  it("uses the local calendar day, not the UTC one", () => {
    // 22:30 UTC on the 31st is already 01:30 on 1 Feb in Amman.
    const keys = periodKeys(new Date("2026-01-31T22:30:00Z"), "Asia/Amman");
    expect(keys.day).toBe("2026-02-01");
    expect(keys.month).toBe("2026-02");
  });

  it("resets at local midnight", () => {
    const keys = periodKeys(new Date("2026-09-26T10:00:00Z"), "Asia/Amman");
    expect(keys.day).toBe("2026-09-26");
    expect(keys.dayResetsAt.toISOString()).toBe("2026-09-26T21:00:00.000Z");
    expect(keys.monthResetsAt.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });

  it("handles the December → January rollover", () => {
    const keys = periodKeys(new Date("2026-12-15T12:00:00Z"), "Asia/Amman");
    expect(keys.monthResetsAt.toISOString()).toBe("2026-12-31T21:00:00.000Z");
  });
});

describe("addMonths", () => {
  it("adds calendar months", () => {
    expect(addMonths(new Date("2026-09-26T10:00:00Z"), 1).toISOString()).toBe(
      "2026-10-26T10:00:00.000Z"
    );
    expect(addMonths(new Date("2026-11-15T00:00:00Z"), 3).toISOString()).toBe(
      "2027-02-15T00:00:00.000Z"
    );
  });

  it("clamps to the last day of shorter months", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z"
    );
  });
});
