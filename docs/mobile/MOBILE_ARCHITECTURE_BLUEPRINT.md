# NiroLearn Native Mobile (Flutter) — Architecture Blueprint

> Companion to [`MOBILE_IMPLEMENTATION_ROADMAP.md`](./MOBILE_IMPLEMENTATION_ROADMAP.md).
> The roadmap tracks **progress**; this file records **what we are building and why**.
> Section numbers (§) are referenced from the roadmap — keep them stable; append new
> sections rather than renumbering.
>
> Status: **DRAFT — awaiting owner approval** (produced 2026-09-29 from a read-only
> audit of the repository and production). Nothing here has been implemented yet.

---

## §0 Product decision

- A **real Flutter app** for Android + iOS. No WebView, no website after login.
  Flow: native splash → authentication → native NiroLearn.
- Same product, same visual identity (ink & highlighter design, Readex Pro + Noto
  Naskh, Niro character), translated into native mobile UX.
- The existing Next.js backend is the **only** backend: same auth, database, tRPC
  API, AI gateway, QStash jobs, OCR, R2 storage, permissions and business logic.
  Flutter is an additional client; the web app keeps working unchanged.
- **No payments in this phase** — no payment SDK, screens or flows; only an
  extension point (§3.6).

## §1 Current platform architecture (as audited 2026-09-29)

| Layer | Facts |
|---|---|
| Web app | Next.js 15 App Router on Railway, Arabic-first (`<html lang="ar" dir="rtl">`), Readex Pro + Noto Naskh Arabic |
| API | tRPC 11 + superjson at `/api/trpc` (`lib/trpc/router.ts`); REST routes under `app/api/*` for upload URLs, pipelines, streaming AI, files, phone verification, registration |
| Auth | Auth.js v5 (`lib/auth.ts`), **JWT session in a cookie** (default 30-day), providers: Credentials (phone *or* email + password) and Google. Every read re-checks the user in the DB (`getSessionUserState`: suspended / deleted / role). tRPC context (`lib/trpc/context.ts`) and 13 API routes call `auth()`. **No password reset exists.** Production `AUTH_URL` = `https://nirolearn.com` |
| Data | Supabase Postgres via Drizzle (`drizzle/schema.ts`, ~65 tables). `.env` DATABASE_URL is **production** |
| Storage | Cloudflare R2; presigned PUT (15 min) for uploads, ownership-checked presigned GET via `/api/files/[...key]`; protected doctor-set images via `/api/question-sets/[setId]/images/[imageId]` (`private, no-store`) |
| Jobs / AI | QStash workers (extract, analyze, generate, finalize, exam-focus, question-file stages), OmniRoute / OpenRouter gateway, server OCR |
| Streaming AI | `/api/assistant/chat` (Niro) and `/api/chat/stream` (book chat) — `text/plain` chunked |
| Flags | `DOCTOR_SETS_ENABLED` (client reads `questionSets.enabled`) |
| Current mobile | Capacitor 8 remote-mode wrapper, Android only — see §A (to be replaced) |

### tRPC routers (student/doctor-facing)

`auth` (me, logout, profile, updateProfile, deleteAccount) · `subjects` · `books`
(list/get/chapters/study content/coverage/mind map/due cards/rate/explain/MCQs/
stats/weak points/forecast/retries/generation jobs/generate*) · `questionFiles` ·
`examFocus` · `mirror` · `decks` · `chat` · `annotations` · `cardMarks` ·
`bookPageMarks` · `sharing` · `brainGames` · `billing` (read-only use) ·
`questionSets` · `doctor` · `materials` (**admin-only since 2026-09-29**).
Admin-only routers stay web-only: `adminBilling, adminMaterials, adminJobs,
adminUsers, adminDoctors, adminQuestionSets`.

## §2 Capability inventory

**Student** — folders (subjects); books (upload → chaptered AI processing);
chapter content; summary (+share); flashcards (due/rate/explain/marks); MCQs;
Exam Focus (+bookmarks); mind map; visual insights; medical note pages; match
game; PDF reader (page marks, annotations, note→card, ask-about-selection); book
chat (streaming, save as note/card); coverage report; generation jobs + retries;
question files (OCR, segmentation, needs-review hidden, image ownership,
bilingual) + question cards; مِرآة (question file → flashcards); decks; Niro
assistant (camera/gallery photo, streaming); games (Math Challenge,
Multiplication, Sudoku, General Knowledge); sharing (username, search, requests,
shared-with-me, revoke, remove, block, in-app notifications); doctor-set
redemption / catalog / protected viewing; account (profile, username, plan
read-only, stats, weak points, forecast, delete account «حذف», logout, legal,
contact). Kept off menus by owner (reachable): today, review, quizzes, weak points.

**Doctor** (flag + approval) — application/status; dashboard + stats; new set
(upload → processing → retry); preview incl. **Needs Review** with reasons and
image checks; settings (title, subject, year, exam type, listed/unlisted,
starts/ends); publish / disable / enable / archive; access codes generate / list
/ revoke (values only visible at generation — stored as HMAC); entitlements list
/ revoke; audit.

**Admin** — web only (users, billing approvals, doctor approvals, set
moderation, admin materials library, jobs, Niro settings).

**System** — OCR, question-document segmentation & validation, AI enrichment &
translation, QStash leases, rate limits (login, redeem), usage metering & plan
limits, audit logs, account deletion cascade.

## §3 Flutter architecture

### §3.1 Location & identity
- Monorepo folder **`mobile/`** (versions together with the API it calls).
- **Reuse `com.nirolearn.app` and the existing `nirolearn-release.keystore`**
  (gitignored, `android/keystore.properties`) with a higher `versionCode`, so the
  Flutter app upgrades the Capacitor app in place. Retire `android/` +
  `capacitor.config.ts` after rollout.

### §3.2 Structure
```
mobile/lib/
  app/        bootstrap, env (dev/staging/prod), router, theme, l10n
  core/
    api/      trpc_client (HTTP + superjson), rest_client, streaming, errors
    auth/     session_store (secure storage), auth_repository, guards
    cache/    drift database, cache policies
    upload/   upload_manager (queue, progress, retry, cancel, background)
    files/    pickers, image_prep (compress, HEIC→JPEG, EXIF), pdf cache
    ui/       NiroLearn design system (tokens + components)
    telemetry/ logging, crash reporting (PII scrubbing)
  features/
    home library upload book study flashcards mcq exam_focus mindmap reader
    notes question_files question_cards mirror assistant book_chat games
    sharing notifications doctor_sets_student doctor account billing(hidden)
```
Each feature: `data/` (repository + models) · `application/` (providers) ·
`presentation/` (screens + widgets).

### §3.3 Packages (each justified; add nothing else without recording why)

| Package | Why |
|---|---|
| flutter_riverpod | server-state caching/invalidation per screen (React-Query role on web), testable |
| go_router | nested tab navigation (StatefulShellRoute), deep/app links, auth redirects |
| dio | upload progress, cancellation, interceptors (token, 401), streamed responses |
| flutter_secure_storage | session token in Keychain / Keystore |
| drift | SQLite offline cache + sync queue; relational queries (due cards) |
| freezed + json_serializable | immutable API models |
| file_picker | native PDF picker (iOS document picker / Android SAF) |
| image_picker | camera + Android Photo Picker / iOS PHPicker (no media permission) |
| flutter_image_compress | HEIC→JPEG, EXIF rotation, resize |
| background_downloader | background uploads (WorkManager / background URLSession) with retry |
| pdfrx | PDFium rendering, both platforms, bounded memory, text selection |
| cached_network_image | question/page images with disk cache (protected: memory-only) |
| markdown_widget | AI content rendering with per-paragraph direction |
| google_sign_in, sign_in_with_apple | native OAuth → backend token exchange |
| flutter_localizations + intl | ar/en ARB, RTL |
| sentry_flutter | crash/error reporting with scrubbing |
| share_plus, url_launcher | native share sheet, external links |
| lucide_icons_flutter | same icon set as web (lucide-react) |
| firebase_messaging | **later phase only** (push) |
| dev: mocktail, integration_test; CLI: Maestro | tests (§19) |

Explicitly not used: WebView, a second backend, GraphQL, BLoC alongside
Riverpod, Hive alongside drift, any payment SDK.

### §3.4 Calling tRPC from Dart
Plain HTTP: query `GET /api/trpc/<path>?input=<urlencoded {"json":…}>`; mutation
`POST /api/trpc/<path>` body `{"json": input}`; response
`{result:{data:{json, meta}}}`; errors `{error:{json:{message, code, data}}}`.
Thin superjson decoder (Date, undefined, BigInt, Map/Set if used). No batching.
Contract tests against staging guard drift (no generated Dart types).

### §3.5 State, errors, logging
Riverpod `AsyncNotifier`/`FutureProvider` per resource; mutation → invalidate
dependents. Error model: network / 401 (→ login) / 403 / 404 / 429 (rate limit)
/ plan limit (`PlanLimitError` details) / server. Arabic user messages.
Sentry scrubs tokens, phones, emails, question text; no request bodies.

### §3.6 Payment extension point (no payments now)
`features/billing/` = read-only plan & usage (`billing.mine`, `plans`) behind a
remote flag; `PurchaseGateway` interface with **no implementation**; plan-limit
sheet is informational only — **no purchase UI, no external payment links**
(also required by Apple 3.1.1).

## §4 Backend / API reuse map

| Flutter feature | Existing API |
|---|---|
| Profile/account | `auth.me/profile/updateProfile/deleteAccount` (confirm «حذف») |
| Folders | `subjects.*` |
| Books | `books.list/get/delete/setSubject/getChapter/listPages/getCoverageReport/Detail` |
| Study | `books.getStudyContent/getKnowledgeCoverage/dueCards/rateCard/explainCard/listMcqs/submitMcqAttempt`, `cardMarks.*` |
| AI generation | `books.startChapterAnalysis/resumeChapterAnalysis/retryChapter/generate*/generationJobs/retryPageVisual/retryExtraction/retryPageText` |
| Exam Focus | `examFocus.*` |
| Mind map | `books.getMindMap/generateMindMapSections` |
| Reader | `/api/files/[...key]`, `/api/books/[bookId]/pages/[n]/image`, `bookPageMarks.*`, `annotations.*`, `/api/books/ask-selection` |
| Book chat | `chat.*`, `/api/chat/stream` |
| Niro | `/api/assistant/chat` |
| Upload | `/api/books/upload-url` → PUT R2 → `/api/books/extract-and-plan` or `/extract-questions-and-plan`; `/api/pdf/upload-url` → `/api/mirror/upload-and-plan` |
| Question files | `questionFiles.list/get/retryExtraction` |
| مِرآة | `mirror.*` |
| Decks | `decks.*` |
| Games | `brainGames.*` |
| Sharing & notifications | `sharing.*` |
| Doctor sets (student) | `questionSets.enabled/redeem/mine/catalog/get` + protected image route |
| Doctor | `doctor.*` |
| Plan (read-only) | `billing.mine/plans` |
| Registration | `/api/phone-verification/start`, `/check`, `/api/register` |

## §5 Navigation map

- Root: Splash → session restore → `AuthFlow` | `MainShell`.
- AuthFlow: Welcome → Login → Register (phone → SMS code → details) → Password
  reset (after G5). No marketing landing in the app.
- MainShell bottom nav (RTL, mirrors `components/BottomNav.tsx`):
  **الرئيسية · ألعاب · ＋ (sheet) · Niro · حسابي**.
  - ＋ sheet: كتاب دراسي · ملف أسئلة · مجلد جديد · كود من دكتورك (flag) → full-screen modal flows.
  - حسابي groups (as web since 2026-09-29): الحساب · دراستي · الإدارة (approved doctor only) · المساعدة · sign out; delete account inside الملف الدراسي.
- Detail screens push inside the current tab; modals for upload/redeem/share/delete; bottom sheets for add, question picker, explanations, actions.
- Back: Android back/predictive back pops within tab → tab root → الرئيسية → exit; iOS edge swipe. Question cards/games never lose answers.
- Deep links (App Links / Universal Links, `nirolearn.com`): `/books/:id`, `/books/question-files/:id`, `/question-sets/:id` (not entitled → redeem), `/shared`, `/doctor/sets/:id`. Unknown → system browser.

## §6 Screen inventory

Default states for every screen: skeleton on first load (cached data shown
instantly, revalidated) · empty = illustration + one action · error = Arabic
message + retry (401 → login, 403/404 → «غير متاح») · offline = cached + banner,
server actions disabled with reason · dynamic type supported.

| # | Screen | Entry | Data / API | Notes |
|---|---|---|---|---|
| 1 | Splash | launch | secure storage, `auth.me` | no network wait with cached profile; version gate (G9) |
| 2 | Welcome | signed out | — | logo, Niro, login/register |
| 3 | Login | Welcome | G1, G2, G3 | suspended / too-many-attempts messages |
| 4 | Register — phone | Login | `phone-verification/start` | Jordanian number rules (port `lib/phone.ts`) |
| 5 | Register — SMS code | 4 | `phone-verification/check` | SMS Retriever / iOS one-time-code autofill |
| 6 | Register — details | 5 | `/api/register` → G1 | |
| 7 | Password reset | Login | G5 | after backend gap |
| 8 | Home | tab | `subjects.list`, `books.list`, `sharing.homeSummary`, `questionFiles.list` | pull to refresh |
| 9 | Folder | Home | `subjects.get/update/delete` | |
| 10 | Book overview | Folder/Home/link | `books.get`, `generationJobs` (poll while running) | chapter status, retries, study tools |
| 11 | Chapter | Book | `books.getChapter` | markdown, visuals, note pages |
| 12 | Summary | Book | `getStudyContent` | share |
| 13 | Flashcards | Book/Deck | `dueCards/rateCard/explainCard/cardMarks` | offline queue |
| 14 | MCQ quiz | Book | `listMcqs/submitMcqAttempt` | |
| 15 | Exam Focus | Book | `examFocus.*` | job progress |
| 16 | Mind map | Book | `getMindMap/generateMindMapSections` | pan/zoom, viewport culling |
| 17 | Match game | Book | study content | |
| 18 | PDF reader | Book | `/api/files`, `bookPageMarks`, `annotations` | pdfrx, selection → ask/note |
| 19 | Book chat | Book/reader | `chat.*`, `/api/chat/stream` | streaming, cancel |
| 20 | Coverage report | Book | `getCoverageReport/Detail` | |
| 21 | Upload book | ＋ | upload manager | |
| 22 | Upload question file | ＋ | upload manager, `extract-questions-and-plan` / mirror | two paths as web |
| 23 | New folder | ＋/Home | `subjects.create` | sheet |
| 24 | Question files list | Home | `questionFiles.list` | |
| 25 | Question file detail | 24/upload | `questionFiles.get` (poll while processing) | |
| 26 | Question cards | 25/38 | same | §11 |
| 27 | مِرآة job | upload/list | `mirror.get` | |
| 28 | Decks list / deck | Home | `decks.*` | |
| 29 | Niro assistant | tab | `/api/assistant/chat` | photo, streaming, local history |
| 30 | Games list | tab | `brainGames.overview` | |
| 31 | Game detail | 30 | `brainGames.game/activeSession` | |
| 32 | Game play ×4 | 31 | `startStage/submitQuiz/sudoku*` | online only |
| 33 | Shared with me | Home/account/link | `sharing.sharedWithMe/removeFromLibrary` | |
| 34 | Share book (sheet) | Book | `sharing.searchUsers/sendRequest/sharesForBook/revoke` | |
| 35 | Notifications | bell | `sharing.notifications/incoming/respond/markNotificationsRead` | poll in foreground |
| 36 | Redeem code | ＋/sets | `questionSets.redeem` | rate-limit messages |
| 37 | My sets / catalog | Home | `questionSets.mine/catalog` | |
| 38 | Protected set | 37/link | `questionSets.get` + protected images | watermark, memory-only, expired/revoked/disabled |
| 39 | Account | tab | `auth.profile`, `billing.mine`, `sharing.profile`, `doctor.status` | |
| 40 | Profile + delete | 39 | `updateProfile`, `deleteAccount` | type «حذف» |
| 41 | Username | 39 | `sharing.setUsername` | |
| 42 | Plan & usage | 39 | `billing.mine` | read-only |
| 43 | Stats | 39 | `books.stats/listWeakPoints/upcomingForecast` | |
| 44 | Blocked users | 39 | `sharing.blocked/unblock` | |
| 45 | Privacy / Terms / Contact | 39 | bundled | keep in sync with web |
| 46 | Doctor application | 39 | `doctor.status/submitApplication` | |
| 47 | Doctor dashboard | 39 الإدارة | `doctor.list/stats` | |
| 48 | New set | 47 | upload manager, `doctor.create` | |
| 49 | Set detail | 47/link | `doctor.get/preview/update/publish/disable/enable/archive/retryProcessing/audit` | Needs Review with reasons |
| 50 | Codes | 49 | codes generate/list/revoke | CSV built on device at generation, share sheet |
| 51 | Students | 49 | entitlements list/revoke | |

## §7 Student plan — everything in §2 Student; nothing dropped.
## §8 Doctor plan — screens 46–51; server gates unchanged; doctor UI only when `doctor.status.approved` and flag on.

## §9 Authentication

- One identity system (Auth.js, `users` + `accounts`). App receives **the same
  encrypted session JWT** the browser keeps in its cookie.
- **G1** `POST /api/mobile/auth/login {identifier,password}` → runs the same
  authorize logic (login limiter, suspended check, bcrypt) → `{token, expiresAt, user}`
  (JWT encoded with `AUTH_SECRET` + session-cookie salt).
- Requests send `Cookie: __Secure-authjs.session-token=<token>` → **no change to
  any existing route or procedure**; `auth()` validates exactly as for web incl.
  per-request DB re-check.
- **G2** Google: native `google_sign_in` → ID token → `/api/mobile/auth/google`
  verifies signature + audience (Android/iOS client IDs), links via `accounts`
  with the web provider's rules → token. **G3** Apple: same.
- Registration: existing 3-step phone flow → G1.
- Restore: cold start reads token → Home from cached profile → background
  `auth.me`. **G4** refresh when < 7 days left.
- 401 → wipe token + private caches → Login («انتهت الجلسة»).
- Logout: wipe token, drift DB, image cache, protected memory. Stateless token;
  "sign out all devices" needs `users.tokenVersion` (optional DB change).
- Account switching: sign out → sign in. **G5** password reset via SMS (new for web too).

## §10 File / PDF / OCR

- Pickers: PDF only (MIME + `%PDF` magic), images via Photo Picker/PHPicker,
  camera permission at point of use, denied → settings sheet.
- Upload manager: `upload-url` → background PUT to R2 (progress, cancel,
  backoff retry, re-request URL after 15-min expiry) → `*-and-plan` → processing.
  Duplicate warning via local fingerprint (size+name+sha1 of first MB).
  True resume of large files needs **G7** (R2 multipart), optional.
- Processing/OCR status: poll `generationJobs` / `questionFiles.get` with backoff
  while visible only.
- Never store/log presigned URLs; PDFs only through `/api/files`; downloaded PDFs
  in app-private LRU cache (~500 MB), wiped on logout.

## §11 Questions

- Server returns valid questions only (needs-review hidden) with options, answer,
  explanation, keywords, source Arabic / machine-translation flag, and **the images
  the server linked** — the app renders only those, so images appear only on
  their own question.
- Native cards: RTL-aware PageView; «السؤال X من N» + bar + tally; picker sheet
  with ✓/✗; tap → green/red + haptic; show answer, explanation, keywords;
  translation toggle; image full-screen zoom + failure placeholder; swipe +
  buttons + hardware arrows; answers persisted per question id (drift) — **never
  on disk for protected sets**.

## §12 AI

| Feature | Call | Streaming | Cancel/retry | Persistence |
|---|---|---|---|---|
| Niro | `POST /api/assistant/chat` | chunked text | CancelToken / retry turn / plan sheet | local (as web) |
| Book chat | `chat.ask`, `/api/chat/stream` | chunked | same | server |
| Ask selection | `POST /api/books/ask-selection` | chunked | same | save as note |
| Explain card | `books.explainCard` | no | retry | cached |
| Chapter generation (summary, cards, MCQs, visuals, notes, mind-map) | `books.start*/generate*/retry*` | jobs | poll `generationJobs`, retry per job | server |
| Exam Focus | `examFocus.*` | jobs | same | server |
| Question enrichment/translation, مِرآة | server pipeline | — | status + retry | server |

AI never runs in Flutter.

## §13 Games
Server-authoritative (`lib/brain-games`): `startStage` returns content,
`submit*` scores, `activeSession` resumes; Sudoku autosaves (`sudokuSave`,
debounced) + `sudokuHint`. Flutter renders timers/grids, haptics, reduced-motion
aware completion animation. Online only.

## §14 Offline / cache

| Data | Offline |
|---|---|
| Profile, plan | readable |
| Folder/book/question-file lists | readable, mutations disabled |
| Opened summaries/chapters/notes | readable |
| Flashcards | review works; ratings queued (G8 for true timestamps) |
| Opened MCQs / question cards | practice works; attempts synced later |
| Previously opened PDFs | readable (LRU) |
| Protected doctor sets | **memory only, never offline** |
| Niro history | readable; sending needs network |
| Games, uploads, AI, sharing | disabled with reason |

## §15 Security
No secrets in the app (only API base URL, public OAuth client IDs, Sentry DSN).
Token in Keychain/Keystore (backup disabled, this-device-only). HTTPS only, ATS
default, no cleartext; pinning deferred. Authorization stays server-side.
Protected sets: memory-only, watermark, Android FLAG_SECURE (product decision
D7), protected image route with token. Sentry scrubbing; release obfuscation
with symbols uploaded. Deep links verified only. Existing rate limits apply;
G1 uses the same login limiter.

## §16 Design system (from `app/base.css`)
Colors: ink #1B2340 · ink-2 #454C66 · ink-3 #6B7188 · paper #F2F4F9 · sheet
#FFFFFF · rule #DFE3EC · rule-strong #C9CEDB · niro #3355FF · niro-deep #2440C7 ·
niro-soft #E9EEFF · marker #FFD43B · marker-soft #FFF3C4 · correct #0E9F6E ·
correct-soft #E2F5EC · wrong #DC3F46 · wrong-soft #FDECEE.
Type: Readex Pro (UI) + Noto Naskh Arabic (reading), bundled; scale
12/13/14/16/18/22/28; line-height 1.6 UI / 1.9 Arabic reading.
Radius sm 6 · md 12 · lg 20. Motion cubic(0.2,0.7,0.3,1), 180–240 ms, reduced
motion respected. Components: buttons (ink primary, marker, outline,
destructive), grouped rows (account list), cards, inputs, chips/badges, dialogs,
sheets with handle, bottom nav with raised ＋, progress, skeletons, empty/error
states with Niro, toasts. Icons: Lucide. Light only at launch (student web has
no dark mode); dark tokens defined but off.

## §17 Arabic / English / RTL
Default `ar` RTL; English UI available. Per-block direction from first strong
character (same rule as web `isArabicText`); per-option direction; FSI/PDI
isolates for English terms, numbers, units, usernames, codes, phone numbers
(LTR). Western digits (as web). Chevrons mirror; "next" follows reading order;
RTL swipe: right→left = next. Markdown renderer sets direction per paragraph.

## §18 Android
minSdk 24, target/compile 36; permissions INTERNET, CAMERA (not required
feature), POST_NOTIFICATIONS only with push; no storage/media permissions.
Predictive back; edge-to-edge + SafeArea; adjustResize; App Links (assetlinks,
G6); WorkManager uploads with foreground notification; flavors dev/staging/prod;
existing keystore + Play App Signing; R8.

## §19 iOS
Min iOS 15; `NSCameraUsageDescription` (ar/en); PHPicker (no library read
permission); UIDocumentPicker; Associated Domains (AASA, G6); Sign in with
Apple; background URLSession; SafeArea; `PrivacyInfo.xcprivacy`; export
compliance exempt; signing via macOS CI (fastlane match / Codemagic).

## §20 Testing
Unit (superjson, tRPC client, auth repo, upload manager, bidi helpers, caches,
answer state) · Widget + goldens (ar/en, small/large) · Contract tests vs
**staging** (nightly) · Backend vitest for G1–G4 · E2E (integration_test +
Maestro) journeys:
1. register → Home; 2. login → kill → restart lands on Home; 3. upload PDF
(airplane mode mid-upload → resume) → processing → summary → flashcards;
4. scanned question file → OCR → cards (image on right question, translation);
5. Niro camera photo (denied → granted); 6. redeem code → open set → revoke on
web → «تم سحب الوصول»; 7. doctor upload → needs-review → publish → codes → CSV;
8. game stage → kill → resume; 9. share book → accept; 10. logout wipes caches;
delete account.
Non-functional: offline suite; startup < 2 s to Home with cached profile
(mid-range Android); 500-question scroll 60 fps; 300-page PDF under memory
budget; large mind map. Devices: Pixel (A16), low-end A8/9, iPhone SE class,
Dynamic Island iPhone.

## §21 CI/CD
Envs dev (→ staging) · **staging (new: own DB + bucket — blocker)** · prod.
PR: analyze, unit/widget, Android debug (ubuntu), iOS unsigned (macOS);
contract tests nightly. Release: `mobile-v*` tag → fastlane → Play internal
track / TestFlight; manual promotion. Secrets in GitHub encrypted secrets.
Semver + monotonic CI build number (> current Play versionCode). Sentry
monitoring. Forced-update gate via G9.

## §22 Store requirements
Apple: 4.8 Sign in with Apple (Google offered) · 5.1.1(v) in-app deletion
(exists) · 1.2 UGC report + block (block exists, **report missing G10**) · 3.1.1
no external payment links · privacy manifest + labels · reviewer demo login (G11).
Google Play: Data safety = `/privacy`; deletion in-app + web URL
(`/account#delete-account`); Photo Picker policy; target 36; App Signing; demo
account (G11).

## §25 Risks & blockers
B1 no staging environment (only production DB) · B2 no macOS here for iOS; needs
CI + Apple Developer account · B3 Apple 4.8 / 1.2 / 3.1.1 · B4 tRPC contract has no
Dart types (mitigate: contract tests, additive-only API changes) · B5 OTP-only
login for reviewers (G11). Other: AI jobs use polling; Niro history is
device-local (no web↔mobile sync); Capacitor app must be upgraded in place.

## §26 API gaps (all additive, backward-compatible)

| # | Gap | Notes |
|---|---|---|
| G1 | `POST /api/mobile/auth/login` | reuse authorize() + limiter |
| G2 | `POST /api/mobile/auth/google` | ID-token exchange, `accounts` linking |
| G3 | `POST /api/mobile/auth/apple` | same |
| G4 | `POST /api/mobile/auth/refresh` | re-issue token |
| G5 | Password reset via SMS (web + mobile) | may need `phone_verifications.purpose` |
| G6 | `/.well-known/assetlinks.json`, `apple-app-site-association` | static |
| G7 | R2 multipart upload URLs (optional) | resumable large uploads |
| G8 | client `reviewedAt` on rateCard/attempts (optional) | offline sync accuracy |
| G9 | `GET /api/mobile/config` | min version, flags |
| G10 | Report content/user | new table |
| G11 | Reviewer demo login | review environment only |
| G12 | Push token register + send on share events | later phase |

## §27 Database changes
None required for the core app. Optional, each needs owner approval:
`phone_verifications.purpose` (G5) · `content_reports` table (G10, needed for
App Store 1.2) · `device_push_tokens` table (G12) · `users.tokenVersion`
(sign-out-all-devices).

## §28 Definition of Done (feature level)
Web parity + same server permissions · ar & en strings, RTL/LTR goldens ·
loading/empty/error/offline implemented · unit + widget + contract + its E2E
journey pass on Android and iOS · no new Sentry errors in beta · performance
budget met · protected data never on disk · a11y (dynamic type, TalkBack /
VoiceOver labels) · design tokens respected.

## §A Appendix — Capacitor wrapper audit (2026-09-29)
Verified on Pixel 6 Pro API 36 emulator with a local debug build:
- Loads `https://alexmed-production.up.railway.app` while `AUTH_URL` is
  `nirolearn.com` → **Google login opens Chrome and never returns**; **logout
  returns `https://nirolearn.com`** which opens externally.
- **Back button exits the app** (no `@capacitor/app`).
- **Offline: blank screen, then Chromium "Webpage not available" (English, shows
  the railway URL), no recovery.**
- Blob CSV downloads (doctor codes, flashcards) don't work in WebView.
- pdf.js canvases never evicted, no DPR cap (memory risk, shared with web).
- Insets & keyboard OK; RTL OK; R2 CORS OK for railway + nirolearn origins.
- No iOS project exists.
These findings motivated the native Flutter decision; they do not need fixing
if the Capacitor app is replaced (except the shared PdfViewer memory issue).
