# NiroLearn

A study app for exam prep: upload PDFs and get back bilingual (Arabic/English)
flashcards, MCQs, chapter summaries, and mind maps — with a real PDF reader
and تضليل/قلم (highlight/pen) annotation on top.

## Two pipelines

The app has two independent upload → generate flows, both organized into
folders ("مواد") the student picks or creates at upload time:

- **ملفات الأسئلة** (`/`, `lib/db-mirror.ts`, `lib/trpc/mirrorRouter.ts`) — upload a
  question file (or paste question text) → get bilingual Q&A flashcards.
  Generation runs immediately in the background (QStash-driven, resumable
  across page reloads).
- **كتبي** (`/books`, `lib/db-books.ts`, `lib/trpc/booksRouter.ts`) — upload a
  study book → it's split into chapters and the original PDF opens right
  away (`/books/[bookId]/read`, `components/PdfViewer.tsx`). Chapter
  analysis (flashcards/MCQs/summary/mind map) is **not** automatic — the
  student explicitly starts it from the book's "ماذا تريد أن تفعل بهذا
  الملف؟" dashboard.

Both pipelines share the same background-job shape: a bare row is created
synchronously (`status: "extracting"`), a QStash message kicks off the real
work, and the client polls/resumes instead of driving generation itself.

## Stack

Next.js (App Router) · tRPC · Drizzle ORM / Postgres (Supabase) · NextAuth v5
· Upstash QStash (background jobs) · S3-compatible object storage · pdf.js
(client-side PDF rendering + annotation layer) · Vitest.

Production runs on **Railway** (not Vercel — an old note in this repo's
history said otherwise; that was wrong/stale).

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, storage, AI gateway, QStash
pnpm dev
```

`.env.example` documents every variable inline — Postgres, Upstash QStash,
NextAuth, S3-compatible storage, and the AI gateway (OmniRoute or
OpenRouter).

### Database migrations

```bash
pnpm db:generate   # writes a new drizzle/migrations/*.sql from schema.ts — safe, local files only
pnpm db:push       # generate + apply via drizzle-kit migrate
```

⚠️ The production database is a **live Supabase instance with real user
data** — never run `db:push` (or anything else) against it without knowing
exactly what you're applying. See `drizzle/migrations/` for the current
migration history.

## Scripts

| Command             | Does                                                  |
| -------------------- | ------------------------------------------------------ |
| `pnpm dev`            | Start the Next.js dev server                           |
| `pnpm build`          | Production build                                       |
| `pnpm check`          | Typecheck (`tsc --noEmit`)                              |
| `pnpm test`           | Run the Vitest suite                                    |
| `pnpm format`         | Prettier `--write` (see caveat below)                   |
| `pnpm db:generate`    | Generate a new Drizzle migration                        |

CI (`.github/workflows/ci.yml`) runs `check` + `test` on every push/PR to
`main` — no secrets required, since both run fully offline (`getDb()`
returns safe defaults with no `DATABASE_URL` configured).

**Caveat:** `app/globals.css` is not Prettier-formatted in this repo —
running `pnpm format` rewrites ~1200 lines of it. Edit that file by hand.
