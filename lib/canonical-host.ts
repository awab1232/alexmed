// Canonical-host normalization is deliberately limited to the one production
// alias we own. Preview, Railway and local hosts must keep their own origins.
export const CANONICAL_ORIGIN = "https://nirolearn.com";
export const WWW_ALIAS_HOST = "www.nirolearn.com";

/**
 * Returns the canonical production URL for the `www` alias, or null when the
 * request is already canonical or belongs to another environment.
 */
export function canonicalHostRedirect(url: URL): URL | null {
  if (url.hostname !== WWW_ALIAS_HOST) return null;
  return new URL(`${url.pathname}${url.search}`, CANONICAL_ORIGIN);
}
