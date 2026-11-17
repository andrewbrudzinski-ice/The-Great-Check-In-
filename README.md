# The Great Check In

**5 check-ins. Every week. No excuses.**

A private, mobile-first competition app for three friends who lift together. Every player needs 5 GPS-verified gym check-ins per week (Monday → Sunday). Hit 5 and you're **SAFE**. If **anyone** misses, the **whole group** does the agreed punishment together, and the tracker keeps score until it's done.

- **Home**: the week, everyone's progress, who's in danger, and a giant **CHECK IN** button.
- **Map**: every verified check-in as a pin, color-coded per player. Tap any check-in (on the map, Home, or a profile) to open its **receipt**: exact phone coordinates (with an Open in Maps link), GPS accuracy, distance from the gym vs. the allowed radius, and the server timestamp.
- **Standings**: leaderboard, *Who's in trouble?*, the group punishment on the line, and streaks.
- **Punishments** (tracker): what the group owes, who caused each one, and a **We did it** button. Done items record who marked them and when, and can be undone.
- **History**: every finished week with an OWED/DONE badge, and a replayable "WEEK OVER" reveal of who sank the group.
- **Profile**: total check-ins, streaks, weeks completed/failed, punishments, a 12-week chart.
- **Gyms**: every gym the group uses. Anyone can add one ("Use my location" while standing inside). A gym added by a non-admin stays **pending** until another player approves it.
- **Settings**: players, avatars, weekly requirement, cooldown, punishment, timezone, title.

Stack: Next.js 16 (static export) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (auth + Postgres) · Leaflet · Motion.

---

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
```

With no Supabase credentials the app runs in **demo mode**. Data lives in your browser's localStorage, comes pre-seeded with ~9 weeks of fake history, and you can play as any player. Demo mode is only for previewing and is not secure. To check in from where you are, open Gyms → **Add gym** → **Use my location**. As Andrew (the demo admin) the gym is approved right away. As anyone else, sign in as another player to approve it.

```bash
npm test           # game-logic tests (week math, standings, streaks, history)
npm run lint       # type-check
npm run build      # static site in ./out
```

## Go live with Supabase

1. **Create a project** at [supabase.com](https://supabase.com).
2. **Run the schema**: open *SQL Editor*, paste [`supabase/schema.sql`](supabase/schema.sql), and run it. It's idempotent, so re-running it is safe.
3. **Keep strangers out.** Pick one:
   - Set an invite code: `update app_private.config set invite_code = 'something-secret';`. Sign-ups must enter it.
   - Or create the three accounts yourself (*Authentication → Users → Add user*) and turn off *Allow new users to sign up*.
   - Once all three of you are in, it's a good idea to disable sign-ups either way.
4. **Turn off email confirmation (required)**: go to *Authentication → Sign In / Providers → Email* and switch off **Confirm email**. Players sign in with a **name + password**. Behind the scenes each name maps to a placeholder address on the reserved `.invalid` domain, which can never receive mail, so a confirmation email could never arrive. Forgotten passwords are reset by the admin under *Authentication → Users*.
5. **Env vars**: copy `.env.example` to `.env.local` and fill in the values from *Project Settings → API*:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
6. **First sign-up becomes the club owner.** Sign up with your name and a password. The owner controls everything: club rules, personal goals, manual check-ins, moving or removing approved gyms, other players' profiles and who's an admin. The owner can make others **admins** (Settings → Players → tap someone → *Make admin*), who get helper powers only: their own gyms are approved instantly, they can approve or turn down pending gyms, pause other players (not themselves or the owner) and delete chat messages. Everyone can edit their own name, avatar and color, and add or edit daily challenges. Existing installs: run `supabase/migrations/009_more_admins.sql` once (the existing admin becomes the owner).
7. **Add your gyms**: stand inside each gym, open Map → *manage* (or Settings → Gyms) → **Add gym** → **Use my location**. The admin's gyms are approved right away; anyone else's need another player to approve them. If you set up the old single-gym version, re-running the schema turns that gym into the first approved gym.

## Deploy to Netlify

The app is a fully static export, so there's no server to run.

1. Push to GitHub and import the repo in Netlify. `netlify.toml` already sets `npm run build` and the `out` publish directory.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under *Site configuration → Environment variables*.
3. Deploy. Geolocation needs HTTPS, which Netlify provides.
4. In Supabase *Authentication → URL Configuration*, set the Site URL to your Netlify URL.

**Add to Home Screen:** the app offers it on Home (dismissible) and in Settings → This phone. On Android and desktop Chrome it's a one-tap **Install**; on iPhone it shows the Share → Add to Home Screen steps. It disappears once you're running the installed version, which opens full screen like a real app.

---

## How it works

### Check-in security

The browser never decides whether a check-in counts. Tapping **CHECK IN** reads GPS **once** and calls the Postgres function `public.check_in(lat, lng, accuracy)`, which:

- requires an authenticated user (`auth.uid()`). You can only ever check in as yourself.
- rejects missing/invalid coordinates and wildly imprecise fixes (> 1 km accuracy).
- computes the distance to every approved gym **server-side**, matches the nearest one you're inside, and rejects anything outside all of them. If you're standing in a gym that's still pending, it says so.
- enforces the cooldown (default 4 h) under a per-player advisory lock, so double taps can't sneak through.
- stamps `checked_in_at` with the **database clock**.

Row-level security lets players read everything but write **no** check-ins directly. There is no insert policy, so the function is the only way in. Players can't make themselves admin or owner either (column-level grants), and the database allows only one owner.

Gyms change only through `add_gym`, `approve_gym`, `update_gym` and `archive_gym`. Nobody can approve a gym they added. Once a gym is approved, only the admin can move it, so nobody can drag it over to their couch. Removed gyms are archived, so past check-ins still count.

This won't stop a determined GPS spoofer, but it makes casual cheating annoying. That's the bar for a friendly bet.

### Privacy

Location is read only when someone taps Check In (or an admin taps "Use my location" in Settings). No `watchPosition`, no background tracking. Only one coordinate per check-in is stored.

### 75 Hard / 75 Soft

The **75 Hard** tab runs 75 Hard, 75 Soft, or a shorter run of either (30, 35 or any length). Each player starts their own run, picks Hard or Soft rules and can edit the daily task list. The tab shows today's checklist, a day ring, and a calendar of the whole run, plus everyone else's runs and the history of past attempts.

- Today and yesterday are tickable, so a late tick after midnight still counts. Older days lock.
- **Hard:** a locked day with anything unticked fails the run, and **Restart at Day 1** starts attempt #2.
- **Soft:** misses are counted, with no reset.
- Honor system: the progress photo is a checkbox.

Writes go through `start_program`, `toggle_program_task` and `end_program`. Existing installs: run `supabase/migrations/004_programs.sql` once.

### Daily challenges

Alongside the gym goal, the group can track daily challenges such as **100 pushups a day**. Each challenge has a name, emoji, daily target and unit (reps, min, km, steps…), and anyone can add, edit or retire one on the **Challenges** page. Players log sets from Home with quick-add buttons (scaled to the target) or a custom amount, and can undo their own sets from today or yesterday. Home shows everyone's progress for today plus daily streaks; the Challenges page adds a 7-day grid. It's honor system (no GPS) and doesn't affect the weekly punishment.

Logs go through `log_challenge()`, which stamps your user, the club-timezone day and the target at that moment, so changing a target never rewrites past days. Existing installs: run `supabase/migrations/003_daily_challenges.sql` once.

**Random daily challenge (default).** Each day one challenge is picked at random for everyone, never the same as the day before when there's a choice. The pool starts as Pushups 100, Sit-ups 100, Burpees 50 and Abs 10 min, and every number is editable in the app. The pick is made by `todays_challenge()` the first time anyone opens the app that day and saved in `challenge_days`, so it's locked in for the day: adding or editing challenges only affects later picks, and retiring today's one picks a new one. The server refuses logs for anything but today's pick. The Challenges page lists what's in the mix (with when each last came up) and an **Ideas** list (squats, plank, pull-ups, steps…) that only joins when someone taps Add. Each exercise keeps its own totals (lifetime total, days done, best single day) on the profile, while the daily streak counts consecutive days doing whatever that day's challenge was. The admin can switch to **All every day** to run every challenge daily instead. Existing installs: run `supabase/migrations/008_challenge_rotation.sql` once.