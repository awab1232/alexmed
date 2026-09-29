# NiroLearn Native Mobile (Flutter) — Implementation Roadmap

> **This file is the single source of truth for mobile progress.** Any agent or
> developer continuing the project reads this first, then
> [`MOBILE_ARCHITECTURE_BLUEPRINT.md`](./MOBILE_ARCHITECTURE_BLUEPRINT.md)
> (referenced below as **BP §n**). Keep it current: update the task, the
> **CURRENT STATUS** block and the **CHANGELOG** in the same change that does the
> work. Never mark anything done that is not implemented **and verified**.

## How to use this file

### Status legend
| Mark | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress (say what is left) |
| `[x]` | Completed **and verified** (record evidence) |
| `[!]` | Blocked (say by what) |
| `[N/A]` | Not applicable (say why) |

### Rules (from the owner, 2026-09-29)
1. At the end of every phase: run the phase's tests → static analysis → build
   verification → security / UI-UX / performance checks → fix findings → only then
   mark the phase `[x]`.
2. Record for each completed phase: what changed, what was tested (with
   results), known limitations, commit hash(es).
3. Do **not** mark tasks complete because files exist, code compiles, a screen is
   mocked, an API is stubbed, a test is skipped, or behaviour is simulated. If it
   cannot be verified → `[!]` or `[~]` with the reason.
4. Use available tools/skills (security review, UI/UX, performance, browser
   verification, code review) automatically where they materially help; record
   which were used in the phase log. Add packages only with a written reason
   (BP §3.3 lists the approved set).
5. Ask the owner only for product/business decisions, credentials, legal
   ownership, paid services, irreversible or production actions. **Never** deploy
   production, change production env vars, run production migrations, commit or
   push without the owner's explicit instruction.
6. Constraints that stay in force: no WebView; no payments (extension point only,
   BP §3.6); backend is reused, changes are **additive and backward-compatible**;
   the web app must keep working; production DB = `.env` DATABASE_URL (never test
   against it — use staging).

### Quality gate (copy into each phase's log when closing it)
```
FUNCTIONAL   [ ] feature works  [ ] happy path  [ ] error path  [ ] loading  [ ] empty
             [ ] retry  [ ] session expiry  [ ] permission enforcement
UI/UX        [ ] design system  [ ] RTL  [ ] LTR where needed  [ ] touch targets ≥48dp/44pt
             [ ] keyboard  [ ] loading/error states  [ ] accessibility  [ ] no layout issues
             [ ] native interaction feels right
SECURITY     [ ] no secrets in client  [ ] authz server-side  [ ] tokens in secure storage
             [ ] sensitive data protected  [ ] protected content not persisted
             [ ] deep links validated  [ ] upload security  [ ] logs scrubbed
PERFORMANCE  [ ] no unnecessary requests  [ ] no leaks  [ ] large content tested
             [ ] lists scroll  [ ] images efficient  [ ] PDF checked  [ ] startup checked
TESTING      [ ] unit  [ ] widget  [ ] integration  [ ] contract  [ ] Android  [ ] iOS
REGRESSION   [ ] web still works (vitest + tsc + next build)  [ ] backend behaviour preserved
             [ ] web auth preserved  [ ] DB behaviour preserved  [ ] nothing unrelated changed
```

### Phase dependency graph
```
P0 ─► P1 ─► P2 ─► P3 ─► P4 ─► P5 ─┬─► P6 ──┐
                                  ├─► P7   │
                                  ├─► P8 ◄─┘ (P8 needs P6 upload manager)
                                  ├─► P9
                                  ├─► P10 ◄─ P6, P8
                                  ├─► P11
                                  └─► P12
P6..P12 ─► P13 (offline) ─► P14 (push, optional v1) ─► P15 (hardening)
P15 ─► P16 (Android) ─┐
P15 ─► P17 (iOS) ─────┴─► P18 (QA + beta) ─► P19 (release)
```

---

## Phase 0 — Repository & Architecture Audit
**Objective:** understand the platform and produce the architecture. **Depends on:** —

- [x] Inspect existing repository (pages, API routes, 23 tRPC routers, schema, flags) — BP §1–§2
- [x] Audit authentication (Auth.js JWT cookie, `auth()` in tRPC context + 13 routes, no password reset, `AUTH_URL`=nirolearn.com) — BP §1, §9
- [x] Audit tRPC / API contracts (superjson, procedures per router, streaming routes) — BP §3.4, §4
- [x] Audit storage (R2 presigned PUT/GET, ownership checks, CORS verified for railway + nirolearn origins) — BP §10
- [x] Audit Question File pipeline (segmentation, needs-review hidden from students, image ownership, bilingual) — BP §11
- [x] Audit Doctor Sets (flag, approval, HMAC codes, entitlements, protected images `no-store`) — BP §8
- [x] Audit web design system (`app/base.css` `--nl-*` tokens, fonts, bottom nav) — BP §16
- [x] Audit existing Capacitor implementation on emulator — BP §A
- [x] Draft Flutter architecture blueprint — BP §0–§28
- [!] **Owner approval of the blueprint** — blocked: waiting for owner review
- [!] **Owner decisions D1–D8** (see Decision Register) — blocked: waiting for owner

**DoD:** blueprint approved; decisions D1–D8 recorded. **Status:** `[~]`

---

## Phase 1 — Infrastructure prerequisites
**Objective:** everything development needs that is not code. **Depends on:** P0.

- [ ] 1.1 Staging environment (D1) — blocker B1
  - [ ] separate Postgres (Supabase project or branch) with migrations 0000–0042 applied
  - [ ] separate R2 bucket + CORS (staging web origin)
  - [ ] staging web deploy (Railway service) with its own `AUTH_SECRET`, `AUTH_URL`, QStash, AI keys (low limits)
  - [ ] seed data: student, approved doctor, admin, sample books/question files/sets
  - [ ] document URLs + test accounts (not passwords) in `docs/mobile/ENVIRONMENTS.md`
- [ ] 1.2 Apple Developer account + team access (D2)
- [ ] 1.3 macOS build path: GitHub macOS runners or Codemagic (D2)
- [ ] 1.4 OAuth clients: Google Android (SHA-256 of upload + Play signing keys), Google iOS; Sign in with Apple service + key
- [ ] 1.5 Sentry project (mobile) — free tier unless owner decides otherwise
- [ ] 1.6 Confirm Play Console state of `com.nirolearn.app` (published? current versionCode?) (D5)

**Backend:** none in code. **Tests:** staging smoke (login, upload, AI job) via web.
**Security:** staging secrets never in git; staging data synthetic only.
**DoD:** staging reachable and seeded; iOS build path proven with an empty app; OAuth clients created.

---

## Phase 2 — Flutter foundation
**Objective:** a buildable, testable app skeleton. **Depends on:** P1 (staging, build paths).

- [ ] 2.1 Create `mobile/` Flutter project (stable channel, record version), appId `com.nirolearn.app`, iOS bundle id (D5)
- [ ] 2.2 Flavors dev/staging/prod via `--dart-define-from-file` (no secrets in files)
- [ ] 2.3 Folder structure per BP §3.2; lint rules (`flutter_lints` + strict analysis)
- [ ] 2.4 `core/api`
  - [ ] tRPC client: query GET / mutation POST, error envelope → typed errors
  - [ ] superjson decoder (Date, undefined, BigInt) + unit tests from real staging payloads
  - [ ] REST client (upload-url, pipelines) + streaming reader (chunked text)
  - [ ] interceptors: auth cookie injection, 401 → session-expired event, 429, plan-limit parsing
- [ ] 2.5 Riverpod setup, error model (BP §3.5), Arabic error messages
- [ ] 2.6 `core/auth/session_store` on flutter_secure_storage (Keychain this-device-only; Android backup disabled)
- [ ] 2.7 go_router skeleton (AuthFlow / MainShell placeholders, redirect by session)
- [ ] 2.8 Telemetry: Sentry with scrubbing (tokens, phones, emails, question text), release + dist
- [ ] 2.9 CI: analyze + unit + widget tests; Android debug build; iOS unsigned build
- [ ] 2.10 Contract test harness against staging (5 procedures: `auth.me`, `subjects.list`, `books.list`, `questionFiles.list`, `brainGames.overview`)

**Tests:** unit (client, decoder, interceptors, session store); widget smoke; contract (2.10).
**Security:** secret scan of repo + build artefacts; verify no tokens in logs.
**Performance:** baseline cold start of empty app (record ms, device).
**Android:** debug build on emulator API 36 + low-end API 26. **iOS:** simulator build via CI.
**DoD:** CI green on both platforms; contract tests pass on staging.

---

## Phase 3 — Design system, localization, RTL
**Objective:** NiroLearn look & feel as reusable Flutter components. **Depends on:** P2.

- [ ] 3.1 Tokens from `app/base.css` (colors, radius, motion) — BP §16
- [ ] 3.2 Bundle Readex Pro + Noto Naskh Arabic (check licences: OFL), type scale
- [ ] 3.3 Components: buttons (ink/marker/outline/destructive), grouped rows, cards, inputs, chips/badges, dialogs, bottom sheets, bottom nav with raised ＋, progress, skeletons, empty/error states (Niro), toasts
- [ ] 3.4 Lucide icons; RTL mirroring rules
- [ ] 3.5 Localization ar (default) + en via ARB; `Directionality` handling
- [ ] 3.6 Bidi helpers: direction by first strong char (port web `isArabicText`), FSI/PDI isolation for terms/numbers/usernames/codes/phones — BP §17
- [ ] 3.7 Component gallery screen (dev flavor only)

**Tests:** widget + golden tests for every component in ar/en, small (360×640) & large (430×932) phones, dynamic type ×1.3.
**UI/UX:** compare against web screenshots (browser verification of the live web app); touch targets; contrast AA.
**DoD:** gallery reviewed; goldens committed; no hard-coded colors outside tokens.

---

## Phase 4 — Authentication
**Objective:** native login/registration with the existing identity system. **Depends on:** P2, P3; backend G1–G4.

Backend (additive; web unaffected):
- [ ] 4.1 Extract the Credentials authorize logic into a reusable function (no behaviour change for web; existing tests stay green)
- [ ] 4.2 **G1** `POST /api/mobile/auth/login` → session JWT (same encoding/salt as cookie) + expiresAt + user; login limiter; suspended/too-many-attempts codes
- [ ] 4.3 **G4** `POST /api/mobile/auth/refresh`
- [ ] 4.4 **G2** `POST /api/mobile/auth/google` (verify ID token signature + audience; link/create via `accounts` with the web provider's rules; suspended check)
- [ ] 4.5 **G3** `POST /api/mobile/auth/apple` (same) — required on iOS if Google is offered
- [ ] 4.6 vitest: token accepted by `auth()` via cookie header; suspended/deleted rejected; limiter; wrong audience rejected; linking rules
- [ ] 4.7 (optional, D3) **G5** SMS password reset (web + mobile); DB change needs approval

Flutter:
- [ ] 4.8 Splash + session restore (cold/warm), cached profile → Home without waiting
- [ ] 4.9 Welcome, Login (phone/email + password), error messages
- [ ] 4.10 Register: phone → SMS code (autofill) → details → auto-login
- [ ] 4.11 Google sign-in; Apple sign-in (iOS; Android optional)
- [ ] 4.12 Refresh scheduling; 401 handling → wipe + login («انتهت الجلسة»)
- [ ] 4.13 Logout wipes token, drift, image caches, protected memory
- [ ] 4.14 Suspended / deleted account handling (message, no loop)

**Tests:** backend vitest (4.6); Flutter unit (auth repository), widget (forms), E2E journeys 1–2 (BP §20) on Android + iOS against staging.
**Security:** token never logged; secure storage verified on device; Google/Apple audience checks; replay of old token after suspension rejected; security review of new endpoints.
**Performance:** cold start with session → Home < 2 s (mid-range Android).
**DoD:** journeys 1–2 pass on both platforms; web login unchanged (web tests + manual check).

---

## Phase 5 — Navigation shell, Home, folders, account, deep links
**Objective:** the app's frame and first real screens. **Depends on:** P4; backend G6, G9.

- [ ] 5.1 MainShell bottom nav (الرئيسية · ألعاب · ＋ · Niro · حسابي) — BP §5
- [ ] 5.2 ＋ sheet (book, question file, folder, doctor code when `questionSets.enabled`)
- [ ] 5.3 Home (folders, recent files, shared summary, question files, sets section)
- [ ] 5.4 Folder screen (list, rename, delete, move file via `books.setSubject`)
- [ ] 5.5 Account screen groups (as web 2026-09-29) + profile/username/plan (read-only)/stats/blocked users/legal/contact
- [ ] 5.6 Delete account (type «حذف») → logout
- [ ] 5.7 **G6** assetlinks.json + AASA on nirolearn.com (web change, additive) + app link handling
- [ ] 5.8 **G9** `/api/mobile/config` + forced-update screen
- [ ] 5.9 Back behaviour (Android predictive back, iOS swipe) per BP §5

**Tests:** widget tests per screen; navigation tests (every route reachable, back stack); deep-link tests (adb / xcrun simctl openurl).
**Security:** deep links only from verified domain; unknown links → browser.
**DoD:** every screen in BP §6 has a route (placeholders allowed only for later phases, marked in code with the phase number).

---

## Phase 6 — Upload manager, book upload, processing
**Objective:** reliable native uploads to R2 through existing endpoints. **Depends on:** P5.

- [ ] 6.1 PDF picker (MIME + `%PDF` check), image picker, camera permission flow (denied → settings)
- [ ] 6.2 Upload manager: upload-url → background PUT (progress, cancel, backoff retry, URL re-request after expiry) → `*-and-plan`
- [ ] 6.3 Duplicate warning (local fingerprint)
- [ ] 6.4 Plan-limit handling (informational sheet, **no purchase UI**)
- [ ] 6.5 Book upload flow (folder choice, profile, file kind) = web `app/books/upload`
- [ ] 6.6 Processing status: poll `generationJobs` with backoff while visible; retries (`retryChapter`, `retryExtraction`, `retryPageText`)
- [ ] 6.7 (optional, D3) **G7** multipart for large files

**Tests:** unit (manager state machine incl. expiry/retry/cancel); integration with staging (small + 100 MB PDF); airplane-mode mid-upload; app kill mid-upload.
**Security:** presigned URLs never logged/persisted beyond the upload record; only PDFs accepted.
**Performance:** memory flat during 100 MB upload (streamed from file, not loaded in RAM).
**DoD:** E2E journey 3 (upload part) on both platforms.

---

## Phase 7 — Study features
**Objective:** web parity for studying a book. **Depends on:** P5 (P6 for new books).

- [ ] 7.1 Book overview (chapters, status, study tools grid)
- [ ] 7.2 Chapter content (markdown with per-paragraph direction, visual insights, note pages)
- [ ] 7.3 Summary + share
- [ ] 7.4 Flashcards (due, rate, explain sheet, marks)
- [ ] 7.5 MCQ quiz (one at a time, feedback, results, attempts)
- [ ] 7.6 Exam Focus (units, cards, bookmarks, start/regenerate/retry with job progress)
- [ ] 7.7 Mind map (pan/zoom canvas, viewport culling, generate sections)
- [ ] 7.8 Match game
- [ ] 7.9 Decks (list, deck study)
- [ ] 7.10 Coverage report; stats/weak points/forecast screens

**Tests:** widget per mode; contract tests for each procedure used; golden tests ar/en.
**Performance:** 500-card deck, large mind map (measure frame times, memory).
**UI/UX:** side-by-side with web for each mode (browser verification).
**DoD:** journey 3 (study part) passes; parity checklist per mode signed off.

---

## Phase 8 — PDF reader, annotations, ask-selection, book chat
**Objective:** reading and asking about the source. **Depends on:** P6, P7.

- [ ] 8.1 Signed PDF fetch via `/api/files` → private LRU cache (~500 MB), wiped on logout
- [ ] 8.2 pdfrx reader (page marks, jump, zoom, text selection)
- [ ] 8.3 Annotations (list/create/update/delete, create card from note, search in subject)
- [ ] 8.4 Ask-about-selection (`/api/books/ask-selection`, streaming, save as note)
- [ ] 8.5 Book chat (`chat.*`, `/api/chat/stream`, cancel, save as note/card)

**Tests:** 300-page PDF memory test; streaming cancel test; annotation CRUD contract tests.
**Performance:** memory budget recorded and met on low-end Android.
**DoD:** reader usable for a 300-page book on low-end Android without crash.

---

## Phase 9 — Question files, question cards, مِرآة
**Objective:** native question experience. **Depends on:** P6.

- [ ] 9.1 Question file upload path (`extract-questions-and-plan`) + مِرآة path (`mirror/upload-and-plan`, `submitText`)
- [ ] 9.2 List + detail with processing/OCR status and failure reasons; `retryExtraction`
- [ ] 9.3 Question cards (BP §11): progress, picker, answer feedback + haptics, explanation, keywords, notes, translation toggle (source vs machine), images with zoom + failure placeholder, swipe/buttons/arrows, persisted answers
- [ ] 9.4 مِرآة job screen (batches, retries)
- [ ] 9.5 Bidi verification with real bilingual fixtures (from `lib/test-fixtures/question-documents.ts` shapes, synthetic data only)

**Tests:** widget tests for card states; E2E journey 4 on staging with synthetic scanned/mixed/bilingual/unnumbered/أبجد files; image-ownership check (image only on its question).
**Performance:** 500-question file: open < 1 s after data, smooth paging.
**DoD:** journey 4 passes both platforms; no needs-review question visible to students.

---

## Phase 10 — Niro assistant
**Objective:** chat with photo input. **Depends on:** P6 (pickers), P8 (streaming reader).

- [ ] 10.1 Chat UI (streaming, copy, retry, cancel)
- [ ] 10.2 Photo from camera/gallery → compress, HEIC→JPEG, EXIF → send
- [ ] 10.3 Local history (drift, like web localStorage; last 60 turns)
- [ ] 10.4 Plan-limit sheet (informational)

**Tests:** journey 5 (permission denied → granted); HEIC fixture; streaming cancel.
**DoD:** journey 5 passes both platforms.

---

## Phase 11 — Doctor sets (student + doctor)
**Objective:** protected sets end to end. **Depends on:** P5, P6, P9 (cards).

Student:
- [ ] 11.1 Redeem code (rate-limit + invalid messages)
- [ ] 11.2 My sets / catalog
- [ ] 11.3 Protected set view: cards reuse (P9) with watermark; **memory-only** cache; images via protected route; expired/revoked/disabled states
- [ ] 11.4 FLAG_SECURE on protected screens (D7)

Doctor:
- [ ] 11.5 Application / status
- [ ] 11.6 Dashboard + stats
- [ ] 11.7 New set upload → processing → retry
- [ ] 11.8 Set detail: preview incl. Needs Review (exact reasons, image checks), settings, publish/disable/enable/archive, audit
- [ ] 11.9 Codes: generate (CSV built on device + share sheet), list, revoke
- [ ] 11.10 Students: entitlements list/revoke

**Tests:** journeys 6–7; verify no protected response on disk (inspect app sandbox after session); `no-store` respected; doctor UI hidden for non-doctors; server rejects student calls to `doctor.*`.
**Security:** dedicated security review of protected-content handling.
**DoD:** journeys 6–7 pass; sandbox inspection clean.

---

## Phase 12 — Games
**Objective:** the four brain games. **Depends on:** P5.

- [ ] 12.1 Games list + game detail (stages, progress)
- [ ] 12.2 Quiz engine UI (Math Challenge, Multiplication, General Knowledge) with timer, haptics, results
- [ ] 12.3 Sudoku grid (number pad, autosave debounced, hints)
- [ ] 12.4 Resume via `activeSession`; online-only messaging

**Tests:** journey 8; scoring parity with web for fixed seeds (contract).
**DoD:** journey 8 passes; results identical to web.

---

## Phase 13 — Sharing, notifications, reporting
**Objective:** social features + store UGC requirements. **Depends on:** P5; backend G10.

- [ ] 13.1 Username, user search, share sheet from book, shares for book, revoke
- [ ] 13.2 Incoming requests (accept/decline), shared-with-me, remove from library
- [ ] 13.3 In-app notifications (poll in foreground), mark read
- [ ] 13.4 Block/unblock
- [ ] 13.5 **G10** report content/user (backend + table — needs approval D3) + UI

**Tests:** journey 9; report flow contract test.
**DoD:** journey 9 passes; report + block available (Apple 1.2).

---

## Phase 14 — Offline cache & sync
**Objective:** honest offline support per BP §14. **Depends on:** P7–P12.

- [ ] 14.1 drift schema for cached lists, study content, question files (not protected sets), Niro history
- [ ] 14.2 Cache policies (stale-while-revalidate, size limits, wipe on logout)
- [ ] 14.3 Offline review queue for flashcards/MCQ/question answers; sync on reconnect (G8 optional)
- [ ] 14.4 Offline banner + disabled actions with reasons

**Tests:** offline suite (every screen in airplane mode); sync conflict tests.
**DoD:** offline suite passes; protected sets confirmed absent from disk.

---

## Phase 15 — Push notifications (optional for v1, D3)
**Depends on:** P13; backend G12 + `device_push_tokens` table (approval).
- [ ] 15.1 FCM/APNs setup, permission prompt at a meaningful moment (Android 13+ POST_NOTIFICATIONS)
- [ ] 15.2 Token register/unregister (logout)
- [ ] 15.3 Server sends on share request/accept, processing finished
- [ ] 15.4 Privacy policy update (owner) before release

**DoD:** share request arrives as push on both platforms; policy updated.

---

## Phase 16 — Performance & security hardening
**Depends on:** P6–P14.
- [ ] 16.1 Profile startup, frame times, memory (DevTools) on low-end Android + iPhone SE class; fix regressions
- [ ] 16.2 Request audit (no duplicate/unnecessary calls; polling stops off-screen)
- [ ] 16.3 Image cache limits; PDF cache limits
- [ ] 16.4 Security review: token handling, storage, logs, deep links, uploads, protected content, dependencies (`flutter pub outdated` + advisories), obfuscation + symbols
- [ ] 16.5 Fix findings; record results

**DoD:** budgets in BP §20 met; no open High/Critical security findings.

---

## Phase 17 — Android polish & Play readiness
**Depends on:** P16.
- [ ] 17.1 Adaptive icon, splash (Android 12+ API), themed status/nav bars
- [ ] 17.2 Predictive back verified on API 34–36; edge-to-edge on API 35–36
- [ ] 17.3 Release signing with existing keystore; Play App Signing; versionCode > current (D5)
- [ ] 17.4 Data safety form draft matching `/privacy`; account deletion URL
- [ ] 17.5 Internal testing track build

**DoD:** internal track build installs as an update over the Capacitor app (if published) and passes smoke.

---

## Phase 18 — iOS polish & App Store readiness
**Depends on:** P16; D2.
- [ ] 18.1 App icon, launch screen, safe areas (notch/Dynamic Island), keyboard
- [ ] 18.2 Info.plist strings (ar/en), `PrivacyInfo.xcprivacy`, export compliance
- [ ] 18.3 Associated Domains, Sign in with Apple capability
- [ ] 18.4 No payment UI/links on iOS (3.1.1) verified
- [ ] 18.5 **G11** reviewer demo login; App Privacy labels; TestFlight build

**DoD:** TestFlight build passes smoke on 2 devices.

---

## Phase 19 — Full QA & beta
**Depends on:** P17, P18.
- [ ] 19.1 All 10 journeys (BP §20) on 4 devices (Pixel A16, low-end A8/9, iPhone SE class, Dynamic Island iPhone)
- [ ] 19.2 Offline suite, performance budgets, accessibility pass (TalkBack/VoiceOver, dynamic type)
- [ ] 19.3 Closed beta (Play closed track + TestFlight external); crash-free ≥ 99.5 %
- [ ] 19.4 Web regression: vitest, tsc, next build, manual smoke

**DoD:** zero open Critical/High bugs; beta metrics met.

---

## Phase 20 — Release
**Depends on:** P19; owner approval (production action).
- [ ] 20.1 Store listings (ar/en), screenshots, privacy URLs
- [ ] 20.2 Staged rollout: Play 10 % → 50 % → 100 %; App Store phased release
- [ ] 20.3 Monitor Sentry + server logs for 7 days
- [ ] 20.4 Retire Capacitor (`android/`, `capacitor.config.ts`, `mobile-shell/`, Capacitor deps) after full rollout (separate approved change)

**DoD:** 100 % rollout on both stores; release checklist (BP §29 in roadmap below) complete.

### Release checklist
- [ ] staging sign-off on all journeys (both platforms, 4 devices)
- [ ] mobile auth endpoints security-reviewed
- [ ] AASA + assetlinks live and verified
- [ ] Sign in with Apple + report feature shipped
- [ ] no payment UI/links on iOS
- [ ] privacy manifest, Data safety, App Privacy match `/privacy`
- [ ] reviewer demo account
- [ ] same appId + keystore, higher versionCode
- [ ] Sentry release with symbols; crash-free ≥ 99.5 % in beta
- [ ] web regression suite green

---

## Decision register (owner decisions needed)

| # | Decision | Options / recommendation | Status |
|---|---|---|---|
| D1 | Staging environment (own DB + bucket + deploy) | Required (B1). Recommend a separate Supabase project + Railway service | `[!]` waiting |
| D2 | Apple Developer account + macOS CI | Required for iOS (B2). GitHub macOS runners or Codemagic | `[!]` waiting |
| D3 | Optional gaps in v1: G5 reset, G7 multipart, G8 reviewedAt, G10 report (needed for App Store), G12 push | Recommend v1: G5, G10; later: G7, G8, G12 | `[!]` waiting |
| D4 | Flutter code location | Recommend `mobile/` in this repo | `[!]` waiting |
| D5 | Upgrade the existing Play listing in place (`com.nirolearn.app`, same keystore) | Recommended; confirm whether it is already published and its versionCode | `[!]` waiting |
| D6 | Google login on iOS (forces Sign in with Apple) | Recommend keep Google + add Apple | `[!]` waiting |
| D7 | Block screenshots on protected sets (Android FLAG_SECURE) | Recommend yes for protected screens only | `[!]` waiting |
| D8 | Niro history device-local (as web) | Recommend keep local for v1 | `[!]` waiting |

## Backend contracts added (keep updated)
_None yet._ Each entry: endpoint/procedure · phase · commit · tests · web impact.

## Files changed (keep updated)
| Date | Files | Phase | Commit |
|---|---|---|---|
| 2026-09-29 | `docs/mobile/MOBILE_ARCHITECTURE_BLUEPRINT.md`, `docs/mobile/MOBILE_IMPLEMENTATION_ROADMAP.md` (new) | P0 | not committed (awaiting owner) |

## Known issues (keep updated)
- Capacitor wrapper defects (BP §A) — superseded by the Flutter app; not fixed.
- Shared: `components/PdfViewer.tsx` never frees page canvases and does not cap DPR (web + mobile Safari memory risk) — not in mobile scope; track separately.
- Web: no password reset (G5).

---

## CURRENT STATUS

| Field | Value |
|---|---|
| Current Phase | Phase 0 — Repository & Architecture Audit (`[~]`) |
| Current Task | Owner review of the blueprint + decisions D1–D8 |
| Last Completed Task | Architecture blueprint drafted (BP) + Capacitor audit on emulator |
| Next Task | After approval: Phase 1.1 staging environment (needs D1) |
| Blocked By | Owner approval; D1 (staging), D2 (Apple account / macOS CI) |
| Last Verification | 2026-09-29 — read-only audit; Capacitor debug APK built and exercised on Pixel 6 Pro API 36 emulator |
| Tests | Web: vitest 821 passed / 1 failed (brain-games math test timeout under full-suite load; passes alone), tsc pass. Flutter: N/A (no code yet) |
| Build | Web `next build` pass (2026-09-29). Flutter: N/A |
| Security | Audit findings recorded (BP §A, §15); no mobile code yet |
| Performance | Not measured for Flutter (no code yet) |
| UI/UX | Design tokens extracted (BP §16); no screens yet |
| Android | Flutter: not started. Capacitor: audited, not release-ready |
| iOS | Not started; no Apple account / macOS build path yet |
| Last Updated | 2026-09-29 |

## CHANGELOG / IMPLEMENTATION HISTORY

- **2026-09-29** — Audited the Capacitor Android wrapper (emulator): Google login
  and logout leave the app, back exits, offline shows raw Chromium error, blob
  downloads fail, no iOS project. Owner decided to build a **native Flutter app**
  instead of fixing the wrapper.
- **2026-09-29** — Architecture blueprint drafted: Flutter + Riverpod + go_router +
  dio + drift; reuse existing backend; auth via the existing Auth.js session JWT
  issued by new additive mobile endpoints (G1–G4) so no existing route changes;
  no payments (extension point only); protected doctor sets memory-only.
- **2026-09-29** — Roadmap created with phases P0–P20, quality gate, decision
  register D1–D8. Awaiting owner approval before any implementation.
