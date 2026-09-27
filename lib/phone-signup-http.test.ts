import { afterEach, describe, expect, it } from "vitest";
import { requestIp } from "./phone-signup-http";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost/api/phone-verification/start", { headers });

describe("requestIp", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it("uses the address our proxy appended, not a client-written one", () => {
    expect(requestIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe(
      "203.0.113.7"
    );
    expect(requestIp(req({ "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7"
    );
  });

  it("counts extra trusted proxies from the right", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(
      requestIp(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.7, 172.70.0.1" }))
    ).toBe("203.0.113.7");
  });

  it("never trusts a client-sent x-real-ip alone", () => {
    expect(requestIp(req({ "x-real-ip": "9.9.9.9" }))).toBeNull();
  });
});
