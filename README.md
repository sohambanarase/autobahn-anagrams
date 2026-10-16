# Autobahn Anagrams

Road-trip word game. Unscramble German license plates from your window seat, solo or with friends on their own phones.

## Files

| File | What it does |
|---|---|
| `index.html` | The page |
| `game.js` | Game, graphics, multiplayer |
| `words.js` | English + German word lists |
| `config.js` | Your Supabase URL + publishable key (the only file you edit) |
| `api/keepalive.js` | Daily ping so the free Supabase project never pauses |
| `vercel.json` | Tells Vercel to run the keep-alive once a day |
| `supabase-setup.sql` | Run once in Supabase to create the tiny keep-alive table |

`_head.html` and `build.py` are only needed if you change the layout (`python3 build.py` rebuilds `index.html`).

## Deploy (uses your existing GitHub, Vercel and Supabase accounts, separate from your other app)

### 1. Supabase: new project
1. Supabase dashboard → **New project** (do not open your existing one). Region: Frankfurt.
2. **SQL Editor → New query** → paste everything from `supabase-setup.sql` → **Run**. You should see "Success".
3. Copy the **Project URL** (`https://xxxx.supabase.co`) and the **publishable key** (`sb_publishable_...`, or the legacy `anon` key) from **Project Settings → API Keys**. Never use the secret / service_role key.

### 2. Put the keys in config.js
Open `config.js` in a plain text editor (VS Code, Notepad, or TextEdit in plain-text mode) and fill both values between the quotes. Save.

### 3. GitHub: new repo
1. **+ → New repository** → name `autobahn-anagrams` → Create.
2. Click **uploading an existing file** → drag in **everything inside this folder**, including the `api` folder → **Commit changes**.
3. Check that `index.html`, `vercel.json` and the `api` folder sit on the repo's main page.

### 4. Vercel: new project
1. **Add New → Project** → import `autobahn-anagrams` (do not open your existing project).
2. Framework Preset: **Other**. Leave the rest. **Deploy**.

### 5. Check it works
- Open `https://YOUR-LINK.vercel.app/api/keepalive` → should show `"ok":true`.
- Vercel project → **Settings → Cron Jobs** → you should see `/api/keepalive` daily.
- Open the game on laptop + phone → **Road Trip** → lobby says **Online**.

## Troubleshooting
- `/api/keepalive` shows **401 or 404**: the SQL step didn't run, or the key in config.js is wrong.
- Lobby says **Test mode**: config.js keys are empty or didn't save.
- Lobby says **Connection problem**: Supabase → **Realtime → Settings** → allow public channels.
- Updating later: on GitHub use **Add file → Upload files** to replace files. Vercel redeploys by itself.

## Free tier notes
- Supabase free: 2 active projects, about 200 people online at once, 2 million realtime messages a month. A 6-minute trip uses roughly 3,000 messages with 4 players.
- The keep-alive runs once a day (Vercel Hobby allows daily crons), well inside Supabase's 7-day pause window.
- Vercel Hobby is free for personal, non-commercial projects.
