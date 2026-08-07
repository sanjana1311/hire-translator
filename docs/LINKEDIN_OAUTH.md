# LinkedIn OAuth (optional)

The Networking Intelligence tab works **without** LinkedIn: every suggestion ships with a manual
LinkedIn people-search link. Connecting LinkedIn only personalizes suggestions with your own
authorized profile data.

## What the integration does and does not do

- ✅ Uses LinkedIn's official OAuth (`openid profile email`) and the `/v2/userinfo` endpoint.
- ✅ Stores tokens server-side only (Supabase table `linkedin_accounts`, service-role access only).
- ✅ Lets any user disconnect and delete imported data at any time.
- ❌ Never scrapes LinkedIn.
- ❌ Never sends LinkedIn messages automatically.
- ❌ Never retrieves or stores unauthorized second-degree profiles. For people we cannot access,
  the app shows a LinkedIn search link instead.

## Setup for self-hosted deployments

1. Create an app at https://www.linkedin.com/developers/apps.
2. Request the **Sign In with LinkedIn using OpenID Connect** product.
3. Add your redirect URI under *Auth → Authorized redirect URLs*:
   `https://<your-domain>/linkedin-callback`
4. Set these secrets in your deployment (Supabase Edge Function secrets — never in the frontend,
   never committed):

   ```
   LINKEDIN_CLIENT_ID=
   LINKEDIN_CLIENT_SECRET=
   LINKEDIN_REDIRECT_URI=https://<your-domain>/linkedin-callback
   ```

   `.env.example` lists these names only. Real values live in deployment secrets.
5. Redeploy the `linkedin-oauth` Edge Function.

The hosted beta uses the project owner's LinkedIn OAuth app; self-hosted deployments use their own.

## Privacy and data deletion

| Data | Where | Deletion |
| --- | --- | --- |
| LinkedIn access token, member name, profile URL | `linkedin_accounts` (server-only) | Removed on **Disconnect** |
| Networking targets, notes, statuses | `networking_targets` (per user, RLS protected) | Deleted with the job or on account deletion; LinkedIn-imported rows are deleted on Disconnect |

Disconnect from **Dashboard → Networking → LinkedIn → Disconnect**. It revokes local storage of the
token and deletes imported connection data immediately.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "LinkedIn is not configured for this deployment" | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` missing | Add the secrets and redeploy |
| `redirect_uri_mismatch` on LinkedIn | Redirect URI not registered or differs | Ensure it matches `https://<your-domain>/linkedin-callback` exactly |
| "OAuth state mismatch" | Stale browser tab | Retry the connect flow |
| "Could not read your LinkedIn profile (403)" | OpenID Connect product not approved | Request the product in the LinkedIn developer console |
| "LinkedIn rejected the authorization (429)" | Rate limited | Wait and retry later |
