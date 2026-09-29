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
- [x] **Owner approval of the blueprint** — 2026-09-29 owner: «اعمل كومن وبعدها ابدا البناء» (commit, then start building)
- [~] **Owner decisions D1–D8** (see Decision Register) — D4 adopted (recommended default); D1–D3, D5–D8 still open

**DoD:** blueprint approved; decisions D1–D8 recorded. **Status:** `[~]` (only the open decisions remain)

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

- [x] 2.1 Create `mobile/` Flutter project — Flutter 3.47.5 / Dart 3.13.4 (stable), android + ios only, applicationId + iOS bundle id `com.nirolearn.app` (Kotlin namespace stays `com.nirolearn.nirolearn`), minSdk 24, iOS 15.0, display name "NiroLearn", INTERNET permission in the main manifest, Android backup + device transfer disabled — verified on the installed package (versionCode 1, minSdk 24, targetSdk 36, flags without ALLOW_BACKUP). D5 (Play state) still open.
- [~] 2.2 Environments via `--dart-define-from-file`: `env/dev.json` (local `http://10.0.2.2:3000`), `env/prod.json` (`https://nirolearn.com`), `env/staging.example.json`; `AppEnv` rejects non-HTTPS non-local URLs. **Left:** staging URL (D1); Android productFlavors so staging and prod install side by side.
- [x] 2.3 Folder structure per BP §3.2; strict analysis (strict-casts / strict-inference / strict-raw-types + extra lints) — `flutter analyze`: no issues
- [~] 2.4 `core/api`
  - [x] tRPC client (`lib/core/api/trpc_client.dart`): query GET / mutation POST, no batching, error envelope → typed errors; tested with a fake HTTP adapter using **real production envelopes** captured read-only
  - [x] superjson decoder/encoder (`lib/core/api/superjson.dart`): Date, undefined, bigint, map, set, number, nested and escaped paths; tests use payloads produced by the server's superjson 1.13.3
  - [~] REST error mapping done (`apiExceptionFromRest`, matches `lib/billing/http.ts`). **Left:** REST helper for upload-url / pipelines (phase 6) and the chunked streaming reader (phases 8/10)
  - [x] interceptors (`lib/core/api/http_client.dart`): session sent as the Auth.js cookie **only to the API origin** (never to presigned R2 URLs — tested); 401 with a session → session rejected; 429 / plan limit (`data.billing`) parsed; transport failures classified network vs server (`apiExceptionFromDio`)
- [x] 2.5 Riverpod 3 providers (`lib/app/providers.dart`); sealed `ApiException` model with Arabic messages (`lib/core/api/api_error.dart`); tRPC's English developer messages are never shown
- [x] 2.6 Session store (`lib/core/auth/session_store.dart`, Keychain first_unlock_this_device) + `SessionController` (restore without network, expiry wipe, 401 → signed out as expired, sign-out hooks) — unit tested with the mock **and** on device: `integration_test/session_storage_test.dart` 3/3 on Pixel 6 Pro API 36 emulator (real Android Keystore round-trip, signed-out → welcome, stored session → Home). iOS Keychain: unverified until an iOS build exists
- [x] 2.7 go_router skeleton (`lib/app/router.dart`): splash / welcome / login / 4-branch StatefulShellRoute + ＋ slot (not a tab); redirect rules as a pure function — unit + widget tested
- [!] 2.8 Telemetry (Sentry) — blocked: needs the Sentry project (task 1.5)
- [~] 2.9 CI workflow `.github/workflows/mobile.yml` written (format, analyze, test, Android debug build on ubuntu; unsigned iOS build on macOS; Flutter from the official repo at the pinned tag; read-only token). **Left:** never run (needs a push) — iOS compile unverified
- [!] 2.10 Contract tests against staging — blocked: no staging environment (D1)
- [x] 2.11 Android debug build — `flutter build apk --debug --dart-define-from-file=env/prod.json` succeeds; installed and launched on the emulator: signed-out → «مرحبًا» screen, RTL, paper background, no crash (screenshot checked). First failed with "not enough space on the disk"; owner asked to free space → `npm cache clean --force` + temp files older than 1 day (6.4 GB). Debug cold start ~16 s on the emulator (JIT debug build — not a performance figure; measure release in P16).
- [x] 2.12 Launcher icon + native splash — **not** reused from `resources/` (those are the old orange "AlexMed" brand, which the design language excludes). Used the current web icon instead: the Niro Spark on ink (`app/icon.svg`), rendered to `mobile/assets/brand/*.png` with sharp; generated with `flutter_launcher_icons` + `flutter_native_splash` (dev-only). Splash = paper + Spark, and the first Flutter frame shows the same. Verified on the emulator (app drawer icon, splash). iOS icon/splash generated, not yet seen on a device.

**Tests:** unit (client, decoder, interceptors, session store); widget smoke; contract (2.10).
**Security:** secret scan of repo + build artefacts; verify no tokens in logs.
**Performance:** baseline cold start of empty app (record ms, device).
**Android:** debug build on emulator API 36 + low-end API 26. **iOS:** simulator build via CI.
**DoD:** CI green on both platforms; contract tests pass on staging.

**Status: `[x]` Completed** — accepted by the owner on 2026-09-29. Open items carried forward, not blocking: 2.2 staging URL (D1), 2.8 Sentry (task 1.5), 2.9 first CI run (needs a push), 2.10 contract tests (D1).

---

## Phase 3 — Design system, localization, RTL
**Objective:** NiroLearn look & feel as reusable Flutter components. **Depends on:** P2.

- [x] 3.1 Tokens (`lib/core/ui/tokens.dart`): all `--nl-*` colours from `app/base.css`, reading ink, radius, 4-pt spacing, `--nl-ease` motion, 48dp touch target
- [x] 3.2 Fonts bundled (`assets/fonts/`): Readex Pro 400/500/600/700 + Noto Naskh Arabic 400/600/700 (static TTFs from Google Fonts, OFL licences included); type scale `NlText` from the web's @nl-design values (h1 28/700, title 18/700, row 16/600, body 15/1.7, reading Naskh 17/1.95). Verified rendering on the emulator
- [~] 3.3 Components (`lib/core/ui/components/`): `NlButton` (primary / marker / secondary / destructive / ghost, loading, press scale, reduced motion), `NlGroup` + `NlRow`, `NlBadge`, `NlProgressBar`, `NlEmptyState`, `NlErrorView` (+ `apiErrorText`), `NlOfflineBanner`, `NlSkeleton` / `NlListSkeleton`, `NlBottomNav` (marker pill on the active tab, raised ink ＋), `NiroImage` — all widget-tested and seen on the emulator. **Left:** `showNlSheet`, `showNlConfirm`, text inputs (themed via `InputDecorationTheme`) are implemented but not yet seen on a device; a dedicated card component when a screen needs one
- [x] 3.4 Lucide icons (`lucide_icons_flutter`, same set as the web's lucide-react); chevrons follow reading direction (tested RTL ← / LTR →)
- [x] 3.5 Localization: gen-l10n with `lib/l10n/app_ar.arb` (template, default) + `app_en.arb`; shell, actions, errors, states localized; English verified in widget tests. New screens add their strings in their phase
- [x] 3.6 Bidi (`lib/core/ui/bidi.dart`): `isArabicText` (same rule as the web), `contentDirection`, `AutoDirText`, `isolate` / `isolateLtr` (FSI / LRI … PDI built from code points) — unit + widget tested, and on the emulator: Arabic sentence with "ACE inhibitor" stays RTL, access code and phone render LTR inside Arabic
- [x] 3.7 Component gallery (`lib/app/dev/component_gallery.dart`, route `/dev/gallery`, **debug builds only**: `kDebugMode`); open with `adb shell am start -n com.nirolearn.app/com.nirolearn.nirolearn.MainActivity --es route /dev/gallery` (Git Bash: prefix `MSYS_NO_PATHCONV=1`)
- [x] 3.8 Niro character: the web's vector art exported to `assets/niro/*.svg` by `tool/export_niro_svgs.tsx` (renders `components/niro/NiroCharacter.tsx` with react-dom/server) — identical on web and app; all 9 load (test + emulator)
- [~] 3.9 Golden (screenshot) tests — deferred: pixel output differs between Windows (here) and Linux (CI), so baselines must be generated on the CI runner. Visual review is done on emulator screenshots meanwhile

**Tests:** widget + golden tests for every component in ar/en, small (360×640) & large (430×932) phones, dynamic type ×1.3.
**UI/UX:** compare against web screenshots (browser verification of the live web app); touch targets; contrast AA.
**DoD:** gallery reviewed; goldens committed; no hard-coded colors outside tokens.

**Status: `[x]` Completed** — accepted by the owner on 2026-09-29. Carried forward: sheets / dialogs / inputs seen on a device as later screens use them; goldens once CI runs on Linux.

---

## Phase 4 — Authentication
**Objective:** native login/registration with the existing identity system. **Depends on:** P2, P3; backend G1–G4.

Backend (additive; web unaffected):
- [x] 4.1 `lib/credentials-login.ts` `verifyCredentials()` — the Credentials check moved out of `lib/auth.ts` unchanged (same rate-limit key, same lookups, same "invalid" for unknown / Google-only / wrong password, suspended only revealed after the password matches); `authorize()` now maps its result to the same `null` / `TooManyAttemptsError` / `AccountSuspendedError`. Web suite 842 passed (1 known slow-test timeout), tsc clean, `next build` ok
- [~] 4.2 **G1** `POST /api/mobile/auth/login` (`app/api/mobile/auth/login/route.ts`) → `{token, expiresAt, cookieName, user}`; 400 / 401 `invalid_credentials` / 403 `account_suspended` / 429 `too_many_attempts`, Arabic messages as the web form, `no-store`. Token = `next-auth/jwt` `encode` with `AUTH_SECRET`, salt = the session cookie name (`lib/mobile-session.ts`); tests prove Auth.js' own `getToken` reads it from the cookie. **Left:** not deployed (needs owner approval) → never exercised against a live server
- [~] 4.3 **G4** `POST /api/mobile/auth/refresh` — requires a valid session via `auth()`, re-reads the user (suspended / deleted → 401), issues a new 30-day token. Tested; not deployed
- [!] 4.4 **G2** Google — blocked: Android/iOS OAuth client IDs (task 1.4) and D6
- [!] 4.5 **G3** Apple — blocked: Apple Developer account (D2)
- [x] 4.6 vitest: `lib/credentials-login.test.ts` (7), `lib/mobile-session.test.ts` (6), `app/api/mobile/auth/login/route.test.ts` (5), `…/refresh/route.test.ts` (3) — 21/21. Audience / linking tests arrive with 4.4–4.5
- [ ] 4.7 (optional, D3) **G5** SMS password reset (web + mobile); DB change needs approval

Flutter:
- [x] 4.8 Splash + session restore without network (P2) + **refresh when < 7 days left** (`features/auth/application/session_refresh.dart`): 401 → signed out with notice; offline → keeps the session
- [~] 4.9 Welcome + Login (`features/auth/presentation/`) — widget-tested (success → Home + stored session, empty form, wrong password keeps signed out) and seen on the emulator (RTL, Niro, LTR identifier, back from login returns to welcome). **Left:** a real sign-in against a server running G1 (staging D1, or owner-approved deploy)
- [~] 4.10 Register: phone (country list + parser ported from `lib/phone.ts`, 7 tests) → SMS code (6 digits, resend countdown, change number, one-time-code autofill hint) → name + password → register → auto sign-in. Repository tested against the web endpoints' real response shapes; invalid-number check seen on the emulator. **Left:** a real SMS round trip (needs staging with SMS; production would send real SMS)
- [!] 4.11 Google / Apple buttons — blocked with 4.4 / 4.5
- [x] 4.12 401 handling (P2) + refresh scheduling (4.8), widget-tested
- [~] 4.13 Sign-out wipes token + registered caches (hooks, tested). **Left:** the sign-out button lives on the Account screen (P5)
- [x] 4.14 Suspended: server message shown on login; a suspended session's next request / refresh → signed out with «انتهت الجلسة»

**Tests:** backend vitest (4.6); Flutter unit (auth repository), widget (forms), E2E journeys 1–2 (BP §20) on Android + iOS against staging.
**Security:** token never logged; secure storage verified on device; Google/Apple audience checks; replay of old token after suspension rejected; security review of new endpoints.
**Performance:** cold start with session → Home < 2 s (mid-range Android).
**DoD:** journeys 1–2 pass on both platforms; web login unchanged (web tests + manual check).

**Status:**
- **Phase 4 implementation: `[x]` Completed** — implemented and tested locally (owner, 2026-09-29). Commits kept separate: backend `ee1c391`, app `9616c5f`.
- **Phase 4 live authentication verification: `[!]` Blocked** by the staging / live environment. `ee1c391` is **not** merged or deployed (owner: no merge / deploy without explicit approval). When staging exists, verify end to end: login, registration + OTP, refresh, logout, Google, Apple.

---

## Phase 5 — Navigation shell, Home, folders, account, deep links
**Objective:** the app's frame and first real screens. **Depends on:** P4; backend G6, G9.

- [x] 5.1 MainShell bottom nav with translated labels (`NlBottomNav`) — verified on emulator
- [x] 5.2 ＋ sheet (`features/library/presentation/add_sheet.dart`): study book, question file, new folder, doctor code only when `questionSets.enabled` (widget-tested both ways; seen on emulator). Upload / redeem targets are placeholders for P6 / P9 / P11
- [x] 5.3 Home (`home_screen.dart`) = web /subjects: greeting + first name (`auth.me`), ink "next step" panel in the web's priority order (due cards → book being prepared → ready book → first upload) with nearest exam, "كتبك" (4, spine = state), sharing row (`sharing.homeSummary`), folders with colour tabs, search from 5 folders, create folder, pull to refresh, inline error + retry. Widget-tested (9) + emulator
- [x] 5.4 Folder screen (`folder_screen.dart`): its books + question files (separate section with badge), move to another folder / none (`books.setSubject`, `decks.setSubject`), rename, delete with confirmation (only the folder — books keep existing: FK is `onDelete: set null`, checked in schema). Widget-tested + emulator
- [~] 5.5 Account (`account_screen.dart`): identity card, الحساب (study profile edit, username, plan), دراستي, الإدارة only for an approved doctor (`doctor.status` asked only while the flag is on), المساعدة (privacy / terms / contact open the web pages in an in-app browser), sign out with confirmation, quiet doctor-apply link. Plan screen read-only (no upgrade / payment UI). Widget-tested (9) + emulator. **Left:** username editing and stats / blocked users screens (placeholders; P13 / P7)
- [x] 5.6 Delete account: inside الملف الدراسي, dialog disabled until «حذف» is typed → `auth.deleteAccount({confirm:"حذف"})` → signed out. Widget-tested
- [!] 5.7 **G6** App Links / AASA — blocked: web change + deploy need owner approval; deep-link handling comes with it
- [!] 5.8 **G9** `/api/mobile/config` + forced update — blocked: backend addition not deployed (owner approval)
- [x] 5.9 Back: inside a tab pops first; at another tab's root back goes to الرئيسية; at الرئيسية's root it leaves the app (PopScope in `MainShell`). Widget-tested. iOS swipe: not verifiable without an iOS build

**Tests:** widget tests per screen; navigation tests (every route reachable, back stack); deep-link tests (adb / xcrun simctl openurl).
**Security:** deep links only from verified domain; unknown links → browser.
**DoD:** every screen in BP §6 has a route (placeholders allowed only for later phases, marked in code with the phase number).

**Status: `[~]` implemented and verified locally** — 5.1–5.4, 5.6, 5.9 done; 5.5 partly (username / stats / blocked users in later phases); 5.7–5.8 blocked on owner-approved backend changes. **Live data not verified:** every screen was checked with in-memory data (widget tests + `integration_test/phase5_screens_test.dart` on the emulator) because signing in needs the undeployed mobile auth endpoints (staging D1).
Quality gate: analyze clean · 100/100 unit + widget · on-device visual run passed (7 screens) · no backend change · security: no new secrets, external pages only from the configured API origin, delete needs the typed word, account data rebuilt on every sign-in / sign-out · UI: RTL, touch targets ≥ 48, Arabic/English mixed titles isolated · found & fixed: retry button clipped inside a fixed-height box (would have been hidden on phones); row chevrons pointed the wrong way in RTL; Riverpod 3's automatic retries turned off (10 silent retries per failure, and a 401 would sign out repeatedly).

---

## Phase 6 — Upload manager, book upload, processing
**Objective:** reliable native uploads to R2 through existing endpoints. **Depends on:** P5.

- [x] 6.1 PDF picker (`file_picker` 13, SAF / document picker, no storage permission) + `checkPdf` (`.pdf` name, `%PDF-` header, plan size limit). Image picker / camera: moved to P10 (Niro), the first screen that needs it
- [~] 6.2 `core/upload/pdf_upload.dart` `PdfUploader`: upload-url → PUT to R2 streamed from disk with progress, cancel, 3 attempts with backoff, fresh signed URL on 403 (expired); session never sent to storage (tested). Leaving a screen mid-upload asks first («إيقاف الرفع؟») because the transfer belongs to the screen. **Deferred by the owner (2026-09-30):** background / resumable upload that survives leaving the app — not before its own phase
- [x] 6.3 Duplicate warning: the picked file's name is compared with the student's library (`books.list`, same title rule as the web) before anything is uploaded → notice with «افتح الموجود»; uploading a new copy stays allowed. Local only, no new dependency (a content hash would need `crypto` and a stored index — not worth it for v1). Widget-tested
- [x] 6.4 Plan limits: size checked before upload; server `FILE_SIZE_LIMIT` / quota errors shown as text, no purchase UI (tested)
- [x] 6.5 Study-book upload (`features/books/presentation/book_upload_screen.dart`, route `/upload/book[?subjectId=]`): same flow as the web's app/books/upload — PDF check → `/api/books/upload-url` → PUT → `/api/books/extract-and-plan {key, fileName, profile, subjectId}` → the book screen. Three steps (book, subject type = the web's 7 profiles, folder — required, create inline); a folder opened from its screen is preselected and its type becomes the default profile until the student picks one; today's remaining study files from `billing.mine`; plan-limit / server errors in Arabic; no purchase UI. The question-file kind is reached through مِرآة from the ＋ sheet (the web's كتبي question-file path stays in 9.1). Shared upload parts moved to `features/upload/upload_widgets.dart` (مِرآة uses them too). Widget-tested (4) + on-device
- [x] 6.6 Processing status (`book_screen.dart`, route `/books/:id`): the web's book-page states — reading pages, «جهّز أدوات الدراسة» (`startChapterAnalysis`), preparing %, ready; stage list (pages, chapters n/N, images n/N, coverage %) with exact missing / failed page numbers; failure reason + `retryExtraction`; failed pages `retryPageText`; failed parts `retryChapter`; `resumeChapterAnalysis` once a minute while the owner's analysis runs (as the web). Polls `books.get` + coverage only while the screen is on top and the app is in the foreground: 3 s, slowing to 15 s while nothing changes, stopping at a terminal state. Shared books are read-only (no start / retries). Widget-tested (7) + on-device (6 states)
- [ ] 6.7 (optional, D3) **G7** multipart for large files — deferred (owner: no resumable uploads now; D3 open)
- [!] 6.8 Live upload against a real server (small + 100 MB PDF, airplane mode mid-upload, app kill) — **blocked: staging (D1)**; production must not be used

**Tests:** unit (manager state machine incl. expiry/retry/cancel); integration with staging (small + 100 MB PDF); airplane-mode mid-upload; app kill mid-upload.
**Security:** presigned URLs never logged/persisted beyond the upload record; only PDFs accepted.
**Performance:** memory flat during 100 MB upload (streamed from file, not loaded in RAM).
**DoD:** E2E journey 3 (upload part) on both platforms.

**Status: `[~]` every buildable task done and verified locally** — 6.1, 6.3–6.6 `[x]`; 6.2 foreground only (background / resumable deferred by the owner); 6.7 deferred (D3); 6.8 live upload `[!]` blocked on staging (D1). iOS not built (D2).
Quality gate (2026-09-30):
```
FUNCTIONAL   [x] feature works (in-memory)  [x] happy path  [x] error path  [x] loading  [x] empty
             [x] retry  [~] session expiry (shared 401 handling, not re-tested live)  [x] permission (shared book: no start / retries)
UI/UX        [x] design system  [x] RTL  [x] LTR where needed (English titles isolated)  [x] touch targets ≥48dp
             [x] keyboard n/a  [x] loading/error states  [~] accessibility (semantics on steps / pills / progress; no screen-reader pass yet)
             [x] no layout issues (1 found + fixed)  [x] native interaction (back asks before stopping an upload)
SECURITY     [x] no secrets in client  [x] authz server-side (only existing checked routes)  [x] tokens in secure storage
             [x] upload security (PDF header + plan size checked first; presigned URL never stored / logged; no cookie to storage)
             [x] logs scrubbed (no logging in the new code)  [ ] deep links n/a (G6 blocked)
PERFORMANCE  [x] no unnecessary requests (backoff, foreground + on-top only, page list only when a page failed)
             [x] no leaks (timers cancelled on dispose / background)  [ ] large content (100 MB live upload blocked on D1)
TESTING      [x] unit  [x] widget  [x] integration (on-device, in-memory)  [ ] contract (staging)  [x] Android  [ ] iOS (D2)
REGRESSION   [x] no web / backend file changed (only mobile/ + docs)  [x] مِرآة tests still pass after the shared-widget refactor
```
Results: analyze clean · Flutter 149/149 unit + widget (22 new) · `integration_test/book_screens_test.dart` on the Pixel 6 Pro API 36 emulator: 8 screens captured and reviewed · found & fixed: the "processing details" header overflowed on narrow / large-font phones (now wraps); the coverage stage kept spinning forever after a permanent page failure (now shows failed, retry below); the integration run hung on `pumpAndSettle` because a book being read animates by design (test uses fixed pumps).
Finding for the owner (backend, not changed): `books.get` returns the whole `pageTexts` column while a book is being read, and `books.listPages` returns every page's `extractedText`; the web polls `books.get` every 3 s. Proposed **G13** (additive, needs approval): leave these out of the polled responses. The app already limits the cost (backoff; page list only on failure).

---

## Phase 7 — Study features
**Objective:** web parity for studying a book. **Depends on:** P5 (P6 for new books).

- [~] 7.1 Book overview built with 6.6 (`book_screen.dart`): title + pages / parts + state, Exam Focus ink panel (`examFocus.get`: ready count / preparing / not made — shared), study tools (cards n, questions n, summary, mind map, match — open when ready, «قيد التجهيز» / lock otherwise), original file row, processing details. Tools open placeholder routes `/books/:id/{study,mindmap,match,exam-focus}` (P7) and `/read` (P8). **Left:** move folder / share from this page (share = P13), remove a shared book
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

- [~] 9.1 مِرآة path done: PDF (`/api/pdf/upload-url` → `/api/mirror/upload-and-plan`) and pasted text (`mirror.submitText`, new file in a folder or added to an existing file), depth quick / balanced / detailed, folder required. **Left:** the كتبي question-file path (`extract-questions-and-plan`)
- [ ] 9.2 List + detail with processing/OCR status and failure reasons; `retryExtraction`
- [ ] 9.3 Question cards (BP §11): progress, picker, answer feedback + haptics, explanation, keywords, notes, translation toggle (source vs machine), images with zoom + failure placeholder, swipe/buttons/arrows, persisted answers
- [x] 9.4 مِرآة: job screen (polls 3 s while running, opens the deck once the first part is ready — same as the web —, failed pages / parts with retry), deck screen (one card at a time, swipe + buttons, progress, all / needs-review / section filters, search, live polling that appends cards without moving the student, add questions, delete), card (tap an option → green / red, reveal, bilingual answer + explanation + key idea + keyword, translation, image with zoom), library of question files. Question splitting ported from `lib/mirror-card-question.ts` and **proven identical** by a parity test on the web code's own output (11 cases). Widget-tested (8) + on-device run of 6 screens. **Not in the app yet:** CSV export, English read-aloud, card highlights (web card marks)
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
| D1 | Staging environment (own DB + bucket + deploy) | Required (B1). Recommend a separate Supabase project + Railway service. Needed before any live-auth testing | **Pending** |
| D2 | Apple Developer account + macOS CI | Required for iOS (B2). GitHub macOS runners or Codemagic | **Pending** |
| D3 | Optional gaps in v1: G5 reset, G7 multipart, G8 reviewedAt, G10 report (needed for App Store), G12 push | Recommend v1: G5, G10; later: G7, G8, G12 | `[!]` waiting |
| D4 | Flutter code location | `mobile/` in this repo | `[x]` adopted 2026-09-29 (owner: start building) |
| D5 | Play listing for `com.nirolearn.app` | Owner 2026-09-30: **not published, not in use** — the Flutter app owns the id from versionCode 1; no in-place upgrade needed | `[x]` decided |
| D6 | Google login on iOS (forces Sign in with Apple) | Recommend keep Google + add Apple | `[!]` waiting |
| D7 | Block screenshots on protected sets (Android FLAG_SECURE) | Recommend yes for protected screens only | `[!]` waiting |
| D8 | Niro history device-local (as web) | Recommend keep local for v1 | `[!]` waiting |

## Backend contracts added (keep updated)
Each entry: endpoint/procedure · phase · commit · tests · web impact.

| Endpoint | Phase | Request → response | Tests | Web impact | Deployed |
|---|---|---|---|---|---|
| `POST /api/mobile/auth/login` | P4 (G1) | `{identifier, password}` → 200 `{token, expiresAt, cookieName, user:{id,name,email,role}}`; 400 `bad_request`, 401 `invalid_credentials`, 403 `account_suspended`, 429 `too_many_attempts` (`{error, code}`) | 5 route + 7 shared-check + 6 token | none — web sign-in uses the same extracted check | **no** |
| `POST /api/mobile/auth/refresh` | P4 (G4) | session cookie → 200 `{token, expiresAt, cookieName}`; 401 when the session / account is no longer valid | 3 | none | **no** |

## Files changed (keep updated)
| Date | Files | Phase | Commit |
|---|---|---|---|
| 2026-09-29 | `docs/mobile/MOBILE_ARCHITECTURE_BLUEPRINT.md`, `docs/mobile/MOBILE_IMPLEMENTATION_ROADMAP.md` (new) | P0 | `57fff35` (branch `docs/mobile-roadmap`) |
| 2026-09-29 | `mobile/` (new Flutter app: `lib/app/*`, `lib/core/api/*`, `lib/core/auth/*`, `lib/core/ui/tokens.dart`, `test/**`, `env/*.json`, Android/iOS identity), `.github/workflows/mobile.yml` | P2 | `9616c5f` (branch `feat/mobile-foundation`) |
| 2026-09-29 | `mobile/lib/core/ui/**` (theme, tokens, bidi, components), `mobile/lib/l10n/*`, `mobile/l10n.yaml`, `mobile/lib/app/dev/component_gallery.dart`, `mobile/assets/{fonts,niro,brand}/`, `mobile/tool/export_niro_svgs.tsx`, generated Android/iOS icon + splash resources, `mobile/integration_test/` | P2–P3 | `9616c5f` (branch `feat/mobile-foundation`) |
| 2026-09-29 | `lib/credentials-login.ts`, `lib/mobile-session.ts`, `lib/auth.ts`, `app/api/mobile/auth/{login,refresh}/` (+ tests) | P4 backend | `ee1c391` |
| 2026-09-29 | `mobile/lib/features/auth/**`, `mobile/lib/core/phone.dart`, `mobile/lib/app/routes.dart`, auth tests | P4 client | `9616c5f` |
| 2026-09-30 | `mobile/lib/features/{library,account}/**`, router, l10n, phase-5 tests | P5 | `d70fe1d` |
| 2026-09-30 | `mobile/lib/core/upload/pdf_upload.dart`, `mobile/lib/features/mirror/**`, `mobile/tool/export_card_question_fixtures.ts`, tests | P6 uploader + P9 مِرآة | `4865df1` |
| 2026-09-30 | `mobile/lib/features/books/**` (new), `mobile/lib/features/upload/upload_widgets.dart` (new), `mirror_start_screen.dart` (shared parts), `pdf_upload.dart` (picker provider), router / routes, folder screen, l10n, `test/features/books/**`, `integration_test/book_screens_test.dart` | P6 book upload + processing, P7.1 | commit "mobile: study-book upload and book screen (phase 6)" |

## Known issues (keep updated)
- Capacitor wrapper defects (BP §A) — superseded by the Flutter app; not fixed.
- Shared: `components/PdfViewer.tsx` never frees page canvases and does not cap DPR (web + mobile Safari memory risk) — not in mobile scope; track separately.
- Web: no password reset (G5).
- Dev machine: drive C: nearly full (~5 GB free, 2026-09-30) — run the emulator and Gradle one at a time.
- Backend (G13 proposal): `books.get` sends `pageTexts` while a book is read and `books.listPages` sends every page's text — heavy on mobile data; the web polls it every 3 s.

---

## CURRENT STATUS

| Field | Value |
|---|---|
| Current Phase | Phase 7 — study features (starting; 7.1 book overview `[~]`). Phase 6 `[~]`: every buildable task done + quality gate passed; background / resumable upload deferred by the owner, G7 deferred (D3), live upload `[!]` (staging). Phases 2, 3, 4-implementation `[x]`; 5 `[~]`; 9.4 مِرآة `[x]` |
| Current Task | 7.4 flashcards / 7.5 MCQ (`books.getStudyContent`, `dueCards`, `rateCard`, `submitMcqAttempt`) |
| Last Completed Task | 6.3 duplicate warning, 6.5 study-book upload, 6.6 processing status + retries, 7.1 overview (first cut) |
| Next Task | Phase 7 in order: 7.4 flashcards → 7.5 MCQ → 7.3 summary → 7.6 Exam Focus → 7.7 mind map → 7.8 match → 7.9 / 7.10. Rule: no push, no production deploy, no merge to `main` without explicit approval |
| Blocked By | Live auth + upload + contract tests: staging (D1) — G1/G4 not deployed, production not to be used; iOS: D2; Sentry (2.8); G6 / G9 / G13 backend changes need approval; Google / Apple login (D6) |
| Last Verification | 2026-09-30 — analyze clean, 149/149 unit + widget, book screens on the emulator (8 screens, in-memory data) |
| Tests | Flutter 149/149 unit + widget; on-device integration runs: session storage, phase-5 screens, مِرآة screens, book screens. Web untouched since `ee1c391` (842 passed then) |
| Build | Android debug APK builds and runs on the API 36 emulator. iOS: not built (no macOS) |
| Security | Session only in secure storage and only to the API origin; uploads: PDF header + plan size checked first, presigned URL never stored / logged, no session to storage; no secrets in `env/*.json` |
| Performance | Polling backs off (3 → 15 s) and stops in the background / under another screen; the heavy page list is fetched only on failure. Release-build measurement in P16 |
| UI/UX | Upload and book screens reviewed on emulator screenshots (RTL, English titles isolated, progress fills from the right) |
| Android | Runs on API 36 emulator. Low-end device check pending |
| iOS | Not built |
| Last Updated | 2026-09-30 |

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
- **2026-09-29** — Owner approved («اعمل كومن وبعدها ابدا البناء»); docs committed
  `57fff35`. Flutter 3.47.5 installed at `C:\Users\user\dev\flutter`. Phase 2
  started on branch `feat/mobile-foundation`: project + identity, strict lints,
  tRPC / superjson client verified against real production envelopes, typed
  Arabic error model, secure session store + controller, router skeleton, CI
  workflow. Decision: the session is sent as the Auth.js cookie and **only** to
  the API origin. Found and fixed by the tests: a garbled server response was
  reported as "no connection"; transport failures are now classified by cause.
  Android build blocked: drive C: full.
- **2026-09-29** — Owner asked to free space and continue: `npm cache clean --force`
  and temp files older than a day (6.4 GB; nothing else touched). Android build
  passes; app runs on the emulator; secure storage verified on device (3/3).
  Note for this machine: never run the emulator and a Gradle build at the same
  time (RAM exhausted once) — `./android/gradlew -p android --stop` after builds.
- **2026-09-29** — Phase 3 design system. Decisions: fonts bundled as static
  weights (no runtime download); Niro rendered from SVGs exported from the web
  component so the art stays identical; app icon/splash = the web's current
  Niro Spark on ink, **not** the old orange "AlexMed" assets in `resources/`;
  goldens deferred until they can be generated on the Linux CI runner. Found
  on device and fixed: gallery content ran under the gesture bar (explicit
  ListView padding drops the automatic safe-area inset); adaptive icon Spark
  too small (enlarged within the safe zone).
- **2026-09-29** — Owner: commit, then continue. Phase 4 started (auth is a
  security-sensitive area — kept additive and not deployed). Decisions: the
  web's Credentials check extracted unchanged into `lib/credentials-login.ts`
  so web and app share one implementation; the app receives the Auth.js
  session JWT (same secret + cookie-name salt) and the response names the
  cookie so the app never guesses it; refresh only works for a session
  `auth()` still accepts. Found by tests: a test assumed "07" is a phone
  number — the parser (unchanged) treats it as an email; test corrected.
  Found on device: hint text of LTR fields sat on the right — fixed.
- **2026-09-29** — Owner accepted Phases 2 and 3 and the Phase 4 implementation;
  live authentication stays blocked until staging exists. No merge / deploy
  of `ee1c391`. D1, D2, D5 pending. Phase 5 started.
- **2026-09-30** — Phase 5 implemented: Home, folder, account, plan, ＋ sheet,
  delete account, back behaviour. Verified with in-memory data only (live data
  needs staging). Decision: Riverpod automatic retry disabled app-wide.
- **2026-09-30** — D5 decided (package not published). P6 uploader + مِرآة built
  with a clearer 3-step start screen, same server pipeline. Found by tests /
  device and fixed: NlButton stretched to full height inside bottom bars
  (Center without heightFactor); card header and footer rows overflowed on
  narrow phones; pasted English text rendered right-to-left. Live data still
  needs staging (D1).
- **2026-09-30** — Phase 6 finished as far as it can go without staging: study-book
  upload (same server flow as the web; folder preselected from its screen, its
  type as default profile), duplicate-name warning, book screen with the web's
  processing states and every retry, polling that backs off and pauses when not
  visible. Leaving mid-upload now asks first (book + مِرآة). Upload parts shared
  by both upload screens. Quality gate recorded under Phase 6. Found and fixed:
  header overflow; never-ending coverage spinner after a permanent page failure.
  Proposed G13 (lighter polled responses) — needs approval. Background /
  resumable upload and G7 left for their phases per the owner. Next: Phase 7.
