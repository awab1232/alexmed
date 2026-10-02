# Phase 2.5 Entity Audit — NiroLearn

Date: 2026-10-02

## Current entity signals

- Official brand spelling in code and public copy is `NiroLearn`.
- Canonical public origin is `https://nirolearn.com`.
- Existing public pages are Arabic-first and server-rendered.
- Existing structured data already describes the organization, website, web application, and FAQ on the homepage.
- Tool pages emit page-level JSON-LD, breadcrumbs, and FAQ where appropriate.

## Brand ambiguity risk

A similarly named external brand can create search/AI confusion. The safest response is not comparison content. NiroLearn should instead publish consistent, accurate, self-contained pages that define what NiroLearn is, what it does, and which domain is official.

## Structured data state

Implemented/available:

- `Organization`
- `WebSite`
- `SoftwareApplication` / `WebApplication`
- `WebPage`
- `BreadcrumbList`
- `Article`
- `FAQPage` where visible FAQ exists

Rules:

- Use stable `@id` values under `https://nirolearn.com/#...`.
- Add `sameAs` only for real official profiles.
- Do not add reviews, ratings, awards, universities, or endorsements that are not independently verified.

## Public content gaps addressed

- Added a `/learn` Knowledge Hub.
- Added official NiroLearn entity page.
- Added guides for AI study, PDF study, flashcards, exam preparation, educational games, and protected question sets.
- Added glossary foundation.

## Arabic and English gaps

- Current public content remains primarily Arabic because the product interface is Arabic-first.
- English queries are tracked in the keyword knowledge base and can be served later with dedicated English pages or bilingual sections where useful.
- Do not blindly translate Arabic pages; English search behavior should be researched independently.

## AI-citability gaps

Improved:

- Direct answers near the top of each Learn article.
- Fact blocks for core entity pages.
- Structured headings, lists, and related links.
- Stable schema IDs connecting content back to NiroLearn.

Still external:

- Google/Bing indexing behavior.
- AI Overview inclusion.
- Third-party citations.
- Bing AI Performance reporting availability.

## Privacy boundaries

Protected doctor question sets, private files, signed URLs, storage keys, access-code internals, student data, doctor private data, and private question content must not become public SEO content. Public pages explain the workflow only.

## Recommended architecture

Use file-based content under `content/learn/` for now. It is simple, testable, and avoids adding a database or CMS. Expand only after there is enough editorial workflow to justify it.
