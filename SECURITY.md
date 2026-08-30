# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security problems.

Report privately through GitHub's [private vulnerability
reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository. Include reproduction steps and impact. Expect an initial
response within 7 days.

## Scope

hireOS handles resumes, job-search history and (optionally) read-only Gmail
data, so the following are treated as high severity:

- Any cross-tenant data access (reading another user's resume, jobs,
  applications, workspaces or Gmail tokens).
- Missing or bypassable Row Level Security on a table in the `public` schema.
- Exposure of Edge Function secrets (service-role key, OAuth client secrets,
  AI provider keys) to the browser or to logs.
- Authentication or session handling flaws.

## Security model for self-hosters

- Every user-facing table has RLS enabled with owner-scoped policies. Ownership
  is resolved through the `is_profile_owner` / `is_workspace_owner`
  `SECURITY DEFINER` helpers, which only ever return a boolean about the
  calling user.
- Resumes are stored in a **private** Supabase Storage bucket; access is
  brokered by signed URLs for the owner only.
- Google/Gmail OAuth tokens are exchanged and stored server-side in Edge
  Functions. They are never sent to the browser.
- The service-role key is only used inside Edge Functions.

If you deploy your own copy, use your own Supabase project and your own AI
provider credentials, and never commit `.env`.
