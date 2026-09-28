import { describe, expect, it } from "vitest";
import {
  decide,
  msUntilNextProbe,
  type BreakerSnapshot,
} from "./circuit-breaker";

const NOW = Date.parse("2026-09-28T12:00:00Z");

function snapshot(partial: Partial<BreakerSnapshot>): BreakerSnapshot {
  return {
    state: "closed",
    consecutiveFailures: 0,
    openedUntil: null,
    probeStartedAt: null,
    ...partial,
  };
}

describe("circuit breaker decisions", () => {
  it("no record or a closed circuit lets the call through", () => {
    expect(decide(null, NOW)).toBe("allow");
    expect(decide(snapshot({ consecutiveFailures: 3 }), NOW)).toBe("allow");
  });

  it("an open circuit skips the model until its cooldown ends", () => {
    const open = snapshot({
      state: "open",
      openedUntil: new Date(NOW + 30_000),
    });
    expect(decide(open, NOW)).toBe("skip");
    expect(decide(open, NOW + 30_001)).toBe("probe");
  });

  it("half-open lets exactly the running probe through, until it goes stale", () => {
    const probing = snapshot({
      state: "half_open",
      probeStartedAt: new Date(NOW - 10_000),
    });
    expect(decide(probing, NOW)).toBe("skip");
    expect(decide(probing, NOW + 6 * 60_000)).toBe("probe");
  });

  it("reports how long until the soonest open circuit may be probed", () => {
    expect(
      msUntilNextProbe(
        [
          snapshot({ state: "open", openedUntil: new Date(NOW + 40_000) }),
          snapshot({ state: "open", openedUntil: new Date(NOW + 10_000) }),
          null,
        ],
        NOW
      )
    ).toBe(10_000);
    expect(msUntilNextProbe([null], NOW)).toBe(0);
  });
});
