# Security policy

hireOS handles resumes, Gmail metadata, job applications, and OAuth tokens.
Please do not report vulnerabilities in a public issue with personal data or
credentials.

Report security issues privately to the repository maintainer. Include a clear
description, reproduction steps that use synthetic data, and the potential
impact. Do not include API keys, OAuth tokens, private email content, or resumes.

## Deployment rules

- Keep `SUPABASE_SERVICE_ROLE_KEY`, provider keys, OAuth client secrets, and
  refresh tokens in Supabase/hosting secrets only.
- Expose only the Supabase publishable/anon key to the frontend.
- Use a separate Supabase project and OAuth application for each deployment.
- Configure redirect URIs for the exact deployment origin.
- Keep resume storage private and use short-lived signed URLs.
- Gmail access must remain read-only and limited to the scopes the user
  explicitly authorizes.
