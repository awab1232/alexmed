import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages are crawlable; the app itself sits behind sign-in (those
// routes redirect to /login), so crawlers are kept off it and the API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
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
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
