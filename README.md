# Swift — hosted web app

A no-build static app (HTML + JS) plus two tiny serverless functions. Deploys to Vercel in minutes. Supabase handles login + database; the Anthropic (Claude) key stays server-side.

## Files
- `index.html` — the app UI
- `app.js` — app logic (auth, screens, logging)
- `plan-data.js` — Aaron's 16-week triathlon plan data
- `api/config.js` — serves the public Supabase settings to the browser
- `api/ai.js` — server-side Claude calls (plan generation + workout adjust)

## Deploy (see the full checklist for click-by-click)
1. Put these files in a GitHub repo called `swift`.
2. In Vercel: **Add New → Project → Import** the repo.
3. Add **Environment Variables** (Vercel → Project → Settings → Environment Variables):
   - `SUPABASE_URL` — your Supabase Project URL (public)
   - `SUPABASE_ANON_KEY` — your Supabase anon public key (public)
   - `ANTHROPIC_API_KEY` — your Claude key (secret)
4. **Deploy.** You'll get a URL like `swift-xxx.vercel.app`.
5. In Supabase → Authentication → URL Configuration, set **Site URL** to that Vercel URL and add it to **Redirect URLs**.
6. Run `swift-db-schema.sql` in the Supabase SQL editor (once) if you haven't.

## Notes
- The app only fully works once deployed (it needs the `/api` functions). To preview locally, run `npx vercel dev`.
- "Load my triathlon plan" lives in the Profile tab — flip it on for your own account. Everyone else gets an AI-generated plan from onboarding.
