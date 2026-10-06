# The Great Check In

**5 check-ins. Every week. No excuses.**

A private, mobile-first competition app for three friends who lift together. Every player needs 5 GPS-verified gym check-ins per week (Monday → Sunday). Hit 5 and you're **SAFE**. If **anyone** misses, the **whole group** does the agreed punishment together, and the tracker keeps score until it's done.

- **Home**: the week, everyone's progress, who's in danger, and a giant **CHECK IN** button.
- **Map**: every verified check-in as a pin, color-coded per player.
- **Standings**: leaderboard, *Who's in trouble?*, the group punishment on the line, and streaks.
- **Punishments** (tracker): what the group owes, who caused each one, and a **We did it** button. Done items record who marked them and when, and can be undone.
- **History**: every finished week with an OWED/DONE badge, and a replayable "WEEK OVER" reveal of who sank the group.
- **Profile**: total check-ins, streaks, weeks completed/failed, punishments, a 12-week chart.
- **Settings**: players, avatars, gym location/radius, weekly requirement, cooldown, punishment, timezone, title.

Stack: Next.js 16 (static export) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (auth + Postgres) · Leaflet · Motion.

---

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
```

With no Supabase credentials the app runs in **demo mode**. Data lives in your browser's localStorage, comes pre-seeded with ~9 weeks of fake history, and you can play as any player. Demo mode is only for previewing and is not secure. To check in from where you are, open Settings → Gym → **Use my location**.

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
4. **Email confirmation**: Supabase sends a confirmation email by default. For a 3-person club you can switch it off under *Authentication → Sign In / Providers → Email*.
5. **Env vars**: copy `.env.example` to `.env.local` and fill in the values from *Project Settings → API*:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
6. **First sign-up becomes admin.** The admin edits club settings. Everyone can edit their own name, avatar and color.
7. **Set the gym**: stand inside the gym, open Settings → Gym → **Use my location**, then Save. Adjust the radius if needed (150 m default).

## Deploy to Netlify

The app is a fully static export, so there's no server to run.

1. Push to GitHub and import the repo in Netlify. `netlify.toml` already sets `npm run build` and the `out` publish directory.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under *Site configuration → Environment variables*.
3. Deploy. Geolocation needs HTTPS, which Netlify provides.
4. In Supabase *Authentication → URL Configuration*, set the Site URL to your Netlify URL.

Add the site to your home screen. It ships a web manifest, so it opens full screen like an app.

---

## How it works

### Check-in security

The browser never decides whether a check-in counts. Tapping **CHECK IN** reads GPS **once** and calls the Postgres function `public.check_in(lat, lng, accuracy)`, which:

- requires an authenticated user (`auth.uid()`). You can only ever check in as yourself.
- rejects missing/invalid coordinates and wildly imprecise fixes (> 1 km accuracy).
- computes the distance to the configured gym **server-side** and rejects anything outside the radius.
- enforces the cooldown (default 4 h) under a per-player advisory lock, so double taps can't sneak through.
- stamps `checked_in_at` with the **database clock**.

Row-level security lets players read everything but write **no** check-ins directly. There is no insert policy, so the function is the only way in. Players can't promote themselves to admin either (column-level grants).

This won't stop a determined GPS spoofer, but it makes casual cheating annoying. That's the bar for a friendly bet.

### Privacy

Location is read only when someone taps Check In (or an admin taps "Use my location" in Settings). No `watchPosition`, no background tracking. Only one coordinate per check-in is stored.

### Weeks, results and streaks

- Weeks run Monday 00:00 → Sunday 23:59 in the club's **timezone** setting.
- `public.finalize_past_weeks()` freezes each finished week into `weeks` + `weekly_results`: the count, pass/fail, and **the punishment that was in force**. Later rule changes never rewrite history. The app calls it on load and when a new week starts while the app is open. It's idempotent and safe to call concurrently. Optionally schedule it too:
  ```sql
  select cron.schedule('finalize-weeks', '5 * * * 1', 'select public.finalize_past_weeks()');
  ```
- The week you join is a warm-up and doesn't count, unless you joined on its Monday. Nobody gets punished for a half week.
- A streak is consecutive finished weeks at or above the requirement. If you've already hit 5 this week, the current week counts toward your streak right away.
- If anyone finishes a week short, `finalize_past_weeks()` creates one row in `punishments` (status `owed`) for the whole group. `set_punishment_done(week, true|false)` lets any player mark it done or undo it, stamped with their id and the server time. Players can't edit the table directly.
- Ranking puts players who've completed the requirement first (earliest finisher on top), then sorts by check-in count. **DANGER** marks whoever is furthest from 5, unless everyone is tied.

### Data model

| table | purpose |
|---|---|
| `users` | player profile (id = auth user id), name, avatar (emoji or image URL), color, is_admin |
| `check_ins` | one row per verified visit: lat/lng, accuracy, distance, gym name, server timestamp |
| `weeks` | one row per finished week (Monday start date) |
| `weekly_results` | frozen per-player result for each week |
| `punishments` | one group punishment per failed week: text, `owed`/`done`, completed_at, completed_by |
| `settings` | single row: title, subtitle, gym name/lat/lng, radius, requirement, cooldown, punishment, timezone |
| `app_private.config` | invite code (not exposed through the API) |

Nothing in the UI hard-codes three players. The board just looks best with three.

### Map tiles

The default is Esri's keyless dark-gray basemap. To use Mapbox, Stadia, MapTiler or another provider, set `NEXT_PUBLIC_MAP_TILE_URL` (and optionally `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`, `NEXT_PUBLIC_MAP_TILE_MAX_ZOOM`). See `.env.example`.

### Project layout

```
src/
  app/                 routes: / map standings punishments history profile settings login
  components/          Board, CheckIn (button + success/failure), WeekReveal, CheckInMap, ui
  lib/
    game.ts            pure game logic: standings, danger, history, streaks, stats
    week.ts            timezone-aware Monday→Sunday week math
    trash.ts           the trash talk (randomized, seeded so it doesn't flicker)
    store.tsx          React context: session, data, check-in flow, live updates
    backend/           Supabase implementation + localStorage demo implementation
supabase/schema.sql    tables, RLS, check_in(), finalize_past_weeks(), set_punishment_done()
```

No money changes hands through this app. Punishments are on the honor system. Shame is enforced.
