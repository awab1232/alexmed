import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";
import { PUBLIC_PATHS, SITE_URL } from "@/lib/site";

describe("public SEO route contract", () => {
  it("publishes exactly the intentional public canonical URLs", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).toEqual(PUBLIC_PATHS.map(path => `${SITE_URL}${path}`));
    for (const privatePath of [
      "/login",
      "/home",
      "/api/trpc",
      "/admin",
      "/books/example",
      "/doctor",
      "/question-sets",
      "/mirror/example",
    ]) {
      expect(urls).not.toContain(`${SITE_URL}${privatePath}`);
    }
  });

  it("keeps private route families out of crawler discovery", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = rules?.disallow;

    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(disallow).toEqual([
      "/api/",
      "/admin",
      "/account",
      "/assistant",
      "/books",
      "/doctor",
      "/games",
      "/home",
      "/materials",
      "/mirror",
      "/question-sets",
      "/review",
      "/shared",
      "/subjects",
      "/today",
    ]);
  });
});
