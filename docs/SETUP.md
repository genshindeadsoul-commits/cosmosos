# Cosmos OS: owner setup

Nothing below can be done from the code alone: it needs your Supabase and Google Cloud consoles.
Until each step is done, the matching feature stays in its honest "Needs setup" state.

## 1. Supabase project
1. Create a project at supabase.com.
2. SQL Editor → run `supabase/migrations/0001_init.sql` (or `supabase db push` with the CLI).
3. Project Settings → API: copy the **Project URL** and the **anon/publishable key**.
4. Copy `.env.example` to `.env.local` and fill:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   Never put the `service_role` key in any `VITE_` variable or in the repo.

## 2. Google sign-in (identity only)
1. Google Cloud Console → APIs & Services → **OAuth consent screen**: configure the app; while in "Testing", add every tester email as a **test user**.
2. **Credentials → Create OAuth client ID → Web application**.
   - Authorized redirect URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
   - Authorized JavaScript origins: your app origin(s), e.g. `http://localhost:3000` and your production URL.
3. Supabase → Authentication → Providers → **Google**: enable, paste Client ID + Client Secret (the secret lives only in Supabase).
4. Supabase → Authentication → URL Configuration: set **Site URL** to production, and add `http://localhost:3000` and the production URL to **Redirect URLs**.
Scopes used for login: `openid email profile` only. Gmail/Calendar/Drive/Sheets consent is separate (section 5).

## 2b. Hosting: single-page-app fallback
The app has real URLs (`/notes`, `/tasks`, ...), so the host must serve `index.html` for unknown paths or a refresh on `/notes` will 404.

- **Cloudflare (Workers static assets):** `wrangler.jsonc` is included and sets `not_found_handling: "single-page-application"`. Deploy command: `npx wrangler deploy` (build command: `npm run build`). **Do not add a `_redirects` catch-all** (`/* /index.html 200`): Cloudflare rejects it as an infinite loop (error 100324).
- **Build-time variables (required):** in the Cloudflare project's *Build* settings add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Vite bakes them into the bundle at build time; if they're missing the deployed app shows "Configuration required".
- **Vercel:** `vercel.json` is included.
- **Other hosts:** add an equivalent "fallback to index.html" rewrite.
- After deploying, add the live URL to Supabase → Authentication → URL Configuration (Site URL and Redirect URLs) and to the Google OAuth client's authorized JavaScript origins, and set `APP_URL` / `ALLOWED_ORIGINS` for the functions (section 5a).

### Troubleshooting sign-in
| Symptom | Cause / fix |
|---|---|
| `Unsupported provider: provider is not enabled` (400 JSON page, or the in-app "Google sign-in is not enabled" message) | Supabase → Authentication → Sign In / Providers → **Google** → enable, paste Client ID and Client Secret, save. |
| `redirect_uri_mismatch` (Google error page) | The Google OAuth client must list exactly `https://<PROJECT_REF>.supabase.co/auth/v1/callback` under Authorized redirect URIs. |
| `Access blocked: app has not completed verification` / `access_denied` | The consent screen is in Testing: add your Google account under **Test users**. |
| Google sign-in completes, then you're back on the login screen (the app now says "couldn't complete it") | **Address mismatch.** Sign-in must finish on the same web address where you clicked *Continue with Google*. On Vercel, the dashboard's Visit button opens a one-off per-deployment address (`project-abc123xyz-team.vercel.app`) that Supabase doesn't know, so it sends you back to the Site URL instead. Fix: open the app at its stable address (e.g. `https://project-team.vercel.app`), **and** add Redirect URL patterns in Supabase → Authentication → URL Configuration: your stable address with `/**`, plus a wildcard for deployment URLs such as `https://*-<team-slug>.vercel.app/**`. Optionally set `VITE_APP_ORIGIN` to the stable address so the login page points people there. |
| Lands back on the login screen with a redirect error | Add the app's exact URL to Supabase → Authentication → URL Configuration → Redirect URLs. |

## 3. First admin
Admins are rows in `public.app_admins`; no client can write that table. After you have signed in once, run in the SQL Editor (service role / dashboard):
```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'you@example.com';
```
Admins see aggregate counts only (`admin_overview()`); no RLS policy gives them access to anyone's records.

## 4. Verify isolation
- Local scratch Postgres: `./supabase/tests/run.sh` (uses a stub of Supabase's `auth` schema).
- On your real project: sign in as two different Google accounts, create a note in each, then in the browser console for account B try `supabase.from('notes').select()`; it must return only B's rows. Re-run the same migration-based checks with real JWTs before trusting production.

## 5. Integrations (one Edge Function: `api`)

Implemented and tested against **mocked** provider responses. None of it has run against the real Google or Spotify services; treat 5f as required.

| Feature | How it works | Needs |
|---|---|---|
| **Apple Music** | Floating widget around Apple's official embedded player (`embed.music.apple.com`). Paste a playlist or album link. | Nothing server-side. No MusicKit, no developer membership. Apple handles sign-in/subscription inside its player. |
| **Gmail** | Official Gmail API via the `api` function. Folders: Inbox, All Mail, Sent, Drafts, Starred, Spam, Trash. | Google OAuth client + secrets below |
| **WhatsApp** | Panel that opens the official `https://web.whatsapp.com/` in a new tab (WhatsApp blocks framing). | Nothing |
| Calendar import, Sheets import, Spotify remote control, Health ingest | Same `api` function | Same Google secrets (+ Spotify app for Spotify) |

### 5a. Secrets (`supabase secrets set`, or Dashboard → Edge Functions → Secrets)
```bash
openssl rand -base64 32            # -> TOKEN_ENCRYPTION_KEY (keep it secret; losing it just forces users to reconnect)
supabase secrets set \
  TOKEN_ENCRYPTION_KEY=<value above> \
  APP_URL=https://oscosmos.vercel.app \
  ALLOWED_ORIGINS=https://oscosmos.vercel.app,http://localhost:3000 \
  GOOGLE_CLIENT_ID=<your OAuth client id> GOOGLE_CLIENT_SECRET=<its secret> \
  SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=...      # only if you want Spotify
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. The Client **Secret** and encryption key must never go in the frontend, Vercel/Cloudflare variables, or this repo.

### 5b. Deploy the function
```bash
supabase db push                      # migrations 0001-0004
supabase functions deploy api         # config.toml sets verify_jwt = false; the router authenticates every route itself
```
No CLI? Supabase Dashboard → Project Settings → Integrations → GitHub can deploy `supabase/functions` on push (set the working directory to the repo root). Not verified here.

### 5c. Google Cloud (same project as sign-in)
1. **APIs & Services → Library**: enable *Gmail API* (and *Calendar API*, *Sheets API* if wanted).
2. **OAuth consent screen → Data access / Scopes**: add `gmail.readonly`, `gmail.modify`, `gmail.send`, `email` (+ `calendar.readonly`, `spreadsheets.readonly` if wanted). Add your Google account(s) as **Test users**.
3. **Credentials → your Web client → Authorized redirect URIs**: add **`https://<PROJECT_REF>.supabase.co/functions/v1/api/oauth-callback`** (keep the existing `/auth/v1/callback` one: that is Supabase sign-in, and it is untouched).

### 5d. Gmail permissions are incremental
- **Connect Gmail** requests **read-only** only.
- **Enable mark read / star** later adds `gmail.modify`; **Enable send email** adds `gmail.send`. Existing grants are kept.
- The server refuses modify/send calls unless that scope is recorded for your account, and `modify` can only change the UNREAD and STARRED labels (never delete/trash). Compose is plain-text only; drafts are listed and readable but not edited.
- Disconnect revokes the token at Google (best effort), deletes the stored credential, and clears the status.

### 5e. Google verification requirements (important)
| Scope | Class | Consequence |
|---|---|---|
| `gmail.readonly`, `gmail.modify` | **Restricted** | Unverified apps: max 100 test users, "unverified app" warning, and in Testing mode refresh tokens expire after **7 days** (users must reconnect weekly). Public launch needs Google verification **plus an annual third-party security assessment (CASA)**. |
| `gmail.send` | Sensitive | Needs Google verification for public use (no CASA by itself). |
Personal use with yourself as a test user needs none of this.

### 5f. Live verification checklist
- [ ] Connect Gmail → status shows your address; Inbox loads real mail; each folder (All Mail, Sent, Drafts, Starred, Spam, Trash) matches what Gmail shows.
- [ ] An archived message appears in All Mail but not Inbox; Spam/Trash show only with those folders.
- [ ] Load more; search inside a folder; open a message with an attachment and download it (file opens, name is sane).
- [ ] Before enabling permissions: Star/Reply show the "enable" prompt. After *Enable mark read / star*: starring and read/unread change in Gmail itself. After *Enable send email*: send a test reply to yourself; it threads correctly in Gmail.
- [ ] Revoke at myaccount.google.com/permissions → next action shows *Reconnect*. Disconnect → `select * from integration_secrets` (service role) has no row for you.
- [ ] Sign-in with Google still works after all of the above (Supabase sign-in is separate).
- [ ] Two accounts: each sees only their own mail and connection state.
- [ ] Apple Music: paste a playlist link → songs play (subscription/browser permitting); drag, minimize, hide, refresh → layout restored.
- [ ] WhatsApp: *Open WhatsApp Web* opens a new tab; scanning the QR links your phone.
- [ ] Calendar/Sheets/Spotify/Health: see the earlier notes if you enabled them.

### Not implemented
Drive linking (needs Google Picker), Sheets export, two-way Calendar sync, Gmail draft editing / trash / delete / labels beyond star and read, HTML mail rendering (plain text only, by design), WhatsApp message access (not possible without scraping), an Android health companion app.

## Known limits (by design or untested)
- **Switching accounts from outside the app** (e.g. signing in as someone else in another tab) discards edits that were still inside the 600 ms save window. Signing out *inside* the app flushes first and asks before discarding if a save fails.
- **Layouts were audited statically, not rendered.** No real browser was available, so the six viewport widths (320/375/768/1024/1280/1536) have not been looked at. Three overflow bugs found by code audit were fixed (music player, toasts, task form). Do a visual pass on a real phone.
- **After sign-in you land on `/`** rather than the page you were on.
- **Tap targets** on small icon buttons are about 24 px (meets WCAG 2.5.8 minimum, below the 44 px comfort guideline).
