// Public-site facts shared by metadata, sitemap, robots and structured data.
// The canonical origin is the production domain; NEXT_PUBLIC_SITE_URL can
// point previews elsewhere without touching the code.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nirolearn.com"
).replace(/\/$/, "");

export const SITE_NAME = "NiroLearn";

export const SITE_TITLE = "NiroLearn | منصة دراسة بالذكاء الاصطناعي من ملفاتك";

export const SITE_DESCRIPTION =
  "ارفع كتابك أو محاضرتك بصيغة PDF، وNiroLearn يحوّلها إلى ملخصات منظمة، وExam Focus لأهم معلومات الامتحان، وبطاقات مراجعة، واختبارات، وخرائط ذهنية، ومساعد دراسة ذكي. ابدأ مجانًا.";

// Public pages worth indexing, in priority order (app pages sit behind
// sign-in and are kept out of the sitemap).
export const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/register",
  "/login",
  "/contact",
  "/privacy",
  "/terms",
] as const;

// Open Graph fields every page shares. Next.js replaces (not merges) a
// parent's openGraph when a page sets its own, so pages spread this in.
export const BASE_OPEN_GRAPH = {
  type: "website",
  siteName: SITE_NAME,
  locale: "ar_AR",
} as const;
