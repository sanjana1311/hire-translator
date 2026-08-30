# Contributing to hireOS

Thanks for your interest in improving hireOS. This project is MIT licensed and
contributions of all sizes are welcome.

## Getting set up

1. Fork and clone the repository.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your own Supabase project values.
4. `npm run dev`

See [README.md](README.md) for the full self-hosting guide (database migrations,
Edge Functions and provider secrets).

## Before you open a pull request

Run the checks locally:

```bash
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

All four must pass. Add or update tests for any behaviour you change — parsing,
scoring and resume logic all live under `src/lib` with tests in
`src/lib/__tests__`.

## Ground rules for the product logic

These are non-negotiable and reviewers will enforce them:

- **The user's resume is the only source of truth.** Never generate code that
  lets the AI invent employers, titles, dates, tools, scope or metrics.
- **No metrics fabrication.** Missing metrics must be requested from the user,
  not guessed.
- **No secrets in the client.** Only `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PROJECT_ID` and the publishable/anon key belong in browser
  code. Everything else lives in Edge Function secrets.
- **No personal data in the repo.** No real resumes, emails, job data or
  screenshots containing them. Fixtures must be synthetic.
- **Row Level Security on every new table**, plus the matching `GRANT`
  statements, in the same migration.

## Commit and PR style

- One logical change per pull request.
- Describe what changed, why, and how you verified it.
- Reference an issue when one exists.

## Reporting bugs and requesting features

Open a GitHub issue with reproduction steps, expected vs actual behaviour, and
your environment. For anything security related, follow
[SECURITY.md](SECURITY.md) instead of filing a public issue.
