# Self-hosting guide

The hosted beta and a self-hosted installation are separate deployments. A
self-hosted installation must use its own Supabase project, OAuth credentials,
AI provider keys, storage, and domain.

## 1. Create Supabase resources

Create a Supabase project, then apply every file in `supabase/migrations` in
filename order. Keep the resume bucket private. Do not use the hosted beta's
database or service-role key.

## 2. Configure the frontend

Copy `.env.example` to `.env` and set:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PROJECT_ID=your-project-ref
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

Run `npm run build` and deploy `dist/` to a static host such as Cloudflare
Pages. Add the same variables in the host's build environment.

## 3. Configure Edge Function secrets

From the project directory:

```bash
supabase link --project-ref your-project-ref
supabase secrets set \
  SUPABASE_URL="https://your-project-ref.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  OPENCODE_GO_API_KEY="your-provider-key"
```

Optional secrets are documented in `.env.example`. Add `GROQ_API_KEY` only if
you want the fallback provider, and add Google OAuth secrets only when Gmail
sync is enabled. All application AI paths use the shared OpenCode Go → Groq
provider order; no Lovable AI key is required.

Deploy functions with:

```bash
supabase functions deploy ai-chat
supabase functions deploy analyze-jd
supabase functions deploy fetch-gmail-jobs
supabase functions deploy gmail-oauth-exchange
supabase functions deploy gmail-sync-cron
supabase functions deploy notify-waitlist
```

## 4. Authentication and Gmail OAuth

Email/password authentication uses the connected Supabase Auth project. Google
login and Gmail sync require the self-hosted operator to configure Google OAuth
in their own Google Cloud project and Supabase Auth settings. Register the
exact frontend callback URL for the deployment, including:

```text
https://your-domain.example/gmail-callback
https://your-project-ref.supabase.co/auth/v1/callback
```

Do not copy the hosted beta's client secret. If Google OAuth is not configured,
the application should continue to support email/password login and clearly
explain that Gmail sync is unavailable.

## 5. Verify before inviting users

Test with synthetic data:

1. create an account;
2. upload and replace a sample resume;
3. add a sample job description;
4. score and tailor the role;
5. verify application status changes persist;
6. verify a sync cannot access another user's data;
7. verify signed resume URLs expire;
8. verify AI and OAuth secrets never appear in browser code or logs.

The open-source repository does not include hosted-beta data, credentials, or
the maintainer's backend.
