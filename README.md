# hireOS

An open-source AI career operating system: import job alerts from your inbox,
score them against your real resume, tailor an ATS-safe resume per role, prep
for interviews, plan networking outreach, and track every application in one
place.

**Live beta:** <https://hire-translator.lovable.app> · **License:** [MIT](LICENSE)

> hireOS is not a generic resume builder. It is a hiring-intent translation
> engine with hard validation gates: your uploaded resume is the only source of
> truth, and the AI is never allowed to invent employers, tools, scope or
> metrics.

---

## Features

| Module | What it does |
| --- | --- |
| **Job import** | Reads job-alert emails from Gmail (read-only), parses multi-job digests into separate roles, deduplicates, and flags low-confidence imports for review. |
| **Match scoring** | Scores each role against your resume into A/B/C/D buckets with strengths, gaps and a recommendation. Scores persist per user + job + resume. |
| **Resume tailoring** | Rewrites bullets in a WHAT → HOW → WHO → IMPACT format using verbatim evidence from your resume, preserving your original layout, and exports ATS-safe PDF/DOCX. |
| **Interview prep** | Company deep dive, hiring signals, behavioural and technical prep, readiness score and a mock interview simulator. |
| **Networking** | Suggested contacts, tailored connection angles, outreach and follow-up templates, plus a tracker. Manual LinkedIn search links — nothing is scraped or auto-sent. |
| **Applications** | Status pipeline (applied → screening → interview → offer → rejected) with a timeline and clickable status filters. |
| **Rejection analysis** | Detects rejection emails and surfaces patterns across your search. |
| **Agent integrations (MCP)** | An MCP server exposing your jobs, applications, workspaces and resume to AI agents, authenticated with your own account. |

## Architecture

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Postgres with Row Level Security, Auth, Storage, Edge Functions)
- **AI:** provider-agnostic. OpenCode Go is primary, with Groq as an optional
  fallback. Resume PDF text extraction runs client-side with `pdfjs-dist`, so
  parsing costs nothing.

```text
src/pages       screens (Roles, Workspaces, Applications, Interview Prep, ...)
src/lib         parsing, scoring, resume layout/export, guardrails (+ tests)
src/hooks       data access hooks over Supabase
src/lib/mcp     MCP tool definitions
supabase/functions   Edge Functions (gmail sync, ai-chat, analyze-jd, ...)
supabase/migrations  database schema, RLS policies and grants
```

## Self-hosting

You need your own Supabase project and your own AI provider credentials. This
keeps user data and provider costs under your control.

1. **Install and configure the frontend**

   ```bash
   git clone <your-fork-url>
   cd hireos
   npm install
   cp .env.example .env
   ```

   Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` and
   `VITE_SUPABASE_PUBLISHABLE_KEY`. These three are the only values that belong
   in the browser.

2. **Create the database**

   Apply everything in `supabase/migrations` to your Supabase project
   (`supabase db push`). Create a **private** Storage bucket named `resumes`.

3. **Deploy the Edge Functions and their secrets**

   ```bash
   supabase functions deploy
   supabase secrets set \
     SUPABASE_URL="https://your-project-ref.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
     OPENCODE_GO_API_KEY="your-opencode-go-key"
   ```

   Optional, per integration:

   | Secret | Enables |
   | --- | --- |
   | `GROQ_API_KEY` | fallback AI provider |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in and Gmail job import (`gmail.readonly`) |
   | `RESEND_API_KEY` + `WAITLIST_NOTIFY_EMAIL` (+ optional `WAITLIST_FROM_EMAIL`) | access-request notification emails |
   | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_REDIRECT_URI` | optional LinkedIn profile read, see [docs/LINKEDIN_OAUTH.md](docs/LINKEDIN_OAUTH.md) |

4. **Run it**

   ```bash
   npm run dev          # local development
   npm run build        # production build into dist/
   ```

   Deploy `dist/` to any static host.

Never commit `.env`, service-role keys, provider keys, OAuth secrets or user
resumes.

## Development

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

## Privacy and safety

- Resumes live in a private Storage bucket and are only reachable by their
  owner.
- Gmail access is read-only and tokens are stored server-side, never in the
  browser.
- Every user-facing table enforces Row Level Security scoped to the signed-in
  user.
- The tailoring engine blocks export when a bullet is missing a required metric
  rather than inventing one.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Contributing

Contributions are welcome — start with [CONTRIBUTING.md](CONTRIBUTING.md) and
the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT © Sanjana Ravikumar. See [LICENSE](LICENSE).
