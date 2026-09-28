import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE_URL, TOOL_PAGES } from "@/lib/site";

// Only the public, indexable pages — never app pages behind sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map(path => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority:
      path === "/"
        ? 1
        : path === "/pricing" || path === "/register"
          ? 0.8
          : TOOL_PAGES.some(page => page.href === path)
            ? 0.9
            : 0.5,
  }));
}
