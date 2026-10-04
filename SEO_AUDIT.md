# SEO Audit — NiroLearn

## Verified production observations

- The canonical public origin is `https://nirolearn.com`.
- The public sitemap is valid XML and lists exactly 10 canonical URLs.
- Public pages already render server-side metadata, JSON-LD, and Arabic-first content.
- The site already has `robots.txt`, `sitemap.xml`, `llms.txt`, and route-level canonical metadata.

## Code inspection findings

### Blocking technical issue

- `www.nirolearn.com` serves duplicate `200` pages instead of permanently redirecting to the canonical non-`www` origin.
- That can split signals between two hosts and makes the canonical domain less explicit.

### Non-blocking but important gaps

- `robots.txt` did not originally disallow the private `/doctor` and `/question-sets` route families.
- Five public utility/legal/conversion pages were missing a page-specific `og:url`.
- There was no focused offline regression coverage for the SEO contract.

## File-level remediation

- `middleware.ts`: enforce a permanent redirect from the exact `www` alias to the canonical origin.
- `lib/canonical-host.ts`: isolate the host-normalization logic in a pure helper.
- `lib/site.ts`: keep shared public URL facts in one place.
- `app/robots.ts`: keep private app families out of crawler discovery.
- `app/pricing/layout.tsx`, `app/register/page.tsx`, `app/contact/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`: add explicit `openGraph.url` values.
- `lib/site.test.ts`, `lib/canonical-host.test.ts`, `app/seo-routes.test.ts`: protect the contract with offline tests.

## What is already working

- The canonical sitemap is already deterministic and limited to public pages.
- `robots.txt` already blocks the main authenticated app families.
- The public landing and tool pages already use server-rendered FAQ / JSON-LD content.
- The root layout already sets `metadataBase` for the public origin.

## Post-deploy verification checklist

After an authorized deploy:

1. Open `https://www.nirolearn.com/<public-path>` and confirm it returns one `308` redirect to `https://nirolearn.com/<public-path>` with the query string preserved.
2. Confirm `https://nirolearn.com/robots.txt` still serves the expected crawler rules.
3. Confirm `https://nirolearn.com/sitemap.xml` still lists only the 10 public canonical URLs.
4. Check the canonical and `og:url` values on the public utility/legal/conversion pages.
5. Validate the structured data on the landing page and tool pages.
6. Submit or re-submit the sitemap in Search Console and inspect the canonical URLs.

## Explicit unknowns

- Search Console coverage and indexing status.
- Search rankings and branded-query movement.
- Core Web Vitals and field performance.
- Backlinks and referring-domain quality.
- Rich-result eligibility.
- Real traffic and conversions from organic search.
