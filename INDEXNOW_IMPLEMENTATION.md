# IndexNow Implementation Plan

IndexNow can notify participating search engines about changed public URLs. It does not guarantee indexing.

## When to trigger

Trigger only for intentional public changes:

- New Learn articles
- Updated Learn articles
- Deleted Learn articles
- Changed public feature pages
- Changed canonical public URLs

Do not trigger for:

- Private app pages
- User files
- Protected question sets
- API routes
- Login/account/admin pages
- Unchanged URLs
- Local development saves

## Safe implementation approach

1. Add configuration only after an IndexNow key is available.
2. Store the key in production environment variables, not in source.
3. Serve the key file from the canonical host if required.
4. Add a server-side helper that accepts a bounded list of public URLs.
5. Ensure every URL is under `https://nirolearn.com` and belongs to the public route registry.
6. Call it from deployment/editorial workflows only, not from local scripts using production `.env`.

## Current status

Design documented. No IndexNow key or production trigger has been added in this phase.
