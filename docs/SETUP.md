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

## 5. Integrations (Edge Functions)

Everything below is **implemented and tested against mocked provider responses**, but has **never been run against the real Google, Spotify, or Apple services**. Treat step 5g as required, not optional.

### 5a. Generate an encryption key and set secrets
```bash
openssl rand -base64 32            # -> TOKEN_ENCRYPTION_KEY
supabase secrets set \
  TOKEN_ENCRYPTION_KEY=<value above> \
  APP_URL=https://your-app.example \
  ALLOWED_ORIGINS=https://your-app.example,http://localhost:3000 \
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
  SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... \
  APPLE_TEAM_ID=... APPLE_KEY_ID=... APPLE_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)"
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase automatically. Losing `TOKEN_ENCRYPTION_KEY` makes stored refresh tokens unreadable (users just reconnect); rotating it does the same.

### 5b. Run migrations 0002 and 0003, then deploy
```bash
supabase db push
supabase functions deploy oauth-start oauth-callback oauth-disconnect gmail calendar-import sheets-preview spotify-token apple-music-token health-ingest
```
`supabase/config.toml` turns JWT verification **off** only for `oauth-callback` (browser redirect, authenticated by one-time `state`) and `health-ingest` (authenticated by a per-user ingest token). All other functions verify the caller's Supabase JWT.

### 5c. Google (Gmail, Calendar, Sheets)
1. In the same Google Cloud project: **APIs & Services → Library**: enable *Gmail API*, *Google Calendar API*, *Google Sheets API*.
2. **OAuth consent screen**: add scopes `gmail.readonly`, `calendar.readonly`, `spreadsheets.readonly`, `email`. `gmail.readonly` is a *restricted* scope: unverified apps are limited to 100 test users and show a warning screen; public launch requires Google's verification and a security assessment.
3. **Credentials → your Web client → Authorized redirect URIs**: add `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback` (this is *in addition to* the `/auth/v1/callback` URI used for sign-in).
4. While in "Testing", refresh tokens expire after 7 days, so users will see "Reconnect" weekly until the app is published.

### 5d. Spotify
developer.spotify.com → create an app → Redirect URI `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback`. Playback control needs **Spotify Premium** and an already-open Spotify device; Cosmos OS does not stream audio. In development mode only users you add under *User Management* can authorize.

### 5e. Apple Music
Apple Developer account → Keys → enable *Media Services (MusicKit)* → download the `.p8`. The browser loads MusicKit JS from Apple's CDN and each user authorizes per browser; an Apple Music subscription is required.

### 5f. Health (Android companion)
There is no browser API for Health Connect. In Settings → Health Connect, generate an ingest token and have a companion app `POST` workouts to `/functions/v1/health-ingest` (payload shown in the UI). **No companion app is included**; the endpoint, auth, validation, and idempotency are.

### 5g. Live verification checklist (do this before trusting it)
- [ ] Gmail: connect with a test account → status shows your address → search `from:you` → open a message → *Create task* → task contains a link, not the body.
- [ ] Gmail with an **archived** message: it appears in the default list (All Mail), spam/trash do not.
- [ ] Revoke access at myaccount.google.com/permissions → next Gmail action shows *Reconnect*.
- [ ] Calendar: import twice → no duplicates; edit an event in Google → re-import updates it.
- [ ] Sheets: paste a sheet you own → preview → create table.
- [ ] Spotify: with Spotify open and playing, play/pause/next from the mini-player; with Spotify closed → clear "No active device" message.
- [ ] Apple: Authorize → Play starts from recent tracks.
- [ ] `select * from integration_secrets` as a normal user returns a permission error; as service role, values start with `v1.` (ciphertext).
- [ ] Two different users: each sees only their own connections.
- [ ] Health: `curl` the ingest endpoint with a bad token → 401; with a good token twice → second call reports duplicates.

### Not implemented
| Feature | Why |
|---|---|
| Google Drive linking | Needs the Google Picker (API key + client script) to stay within `drive.file` |
| Export to Google Sheets, live Sheets sync | Import-only by design |
| Two-way Calendar sync | One-way import only; deletions in Google are not mirrored |
| Health companion Android app | Out of scope; ingest API provided |
| Gmail attachments download, send, or label edits | Read-only scope |
