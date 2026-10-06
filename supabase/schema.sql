-- ============================================================================
-- THE GREAT CHECK IN — Supabase schema
--
-- Run this whole file once in the Supabase SQL editor (it is idempotent, so
-- re-running it to pick up changes is safe).
--
-- Security model
--   * Every player is a Supabase Auth user with a row in public.users.
--   * Clients can READ everything (it's a private club) but can never INSERT a
--     check-in directly. The only way in is public.check_in(), which runs in
--     Postgres with the caller's auth.uid(), measures the distance to the gym
--     itself, enforces the cooldown and stamps the server time.
--   * Week results are written by public.finalize_past_weeks(), also server
--     side. Clients call it lazily on load; it is idempotent.
-- ============================================================================

create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Private config (not exposed through the API)
-- ----------------------------------------------------------------------------
create table if not exists app_private.config (
  id          int primary key default 1 check (id = 1),
  -- If set, sign-ups must provide this code. Leave null if you create the
  -- three accounts yourself from the Supabase dashboard.
  invite_code text
);
insert into app_private.config (id, invite_code) values (1, null)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Players
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  avatar     text not null default '💪' check (char_length(avatar) <= 500),
  color      text not null default '#c8ff3d' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Settings (single row)
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  id                 int primary key default 1 check (id = 1),
  app_title          text not null default 'The Great Check In',
  app_subtitle       text not null default '5 check-ins. Every week. No excuses.',
  gym_name           text not null default 'The Gym',
  gym_latitude       double precision check (gym_latitude between -90 and 90),
  gym_longitude      double precision check (gym_longitude between -180 and 180),
  check_in_radius    int not null default 150 check (check_in_radius between 25 and 5000),
  weekly_requirement int not null default 5 check (weekly_requirement between 1 and 14),
  cooldown_hours     numeric not null default 4 check (cooldown_hours between 0 and 24),
  punishment         text not null default 'Saturday 6 AM group workout. Nobody skips.',
  timezone           text not null default 'America/New_York',
  updated_at         timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Gyms. Players can use different gyms; a check-in counts at any approved one.
-- A gym added by a non-admin stays 'pending' until ANOTHER player approves it,
-- so nobody can quietly register their living room.
-- (settings.gym_* columns are the pre-multi-gym location, migrated below.)
-- ----------------------------------------------------------------------------
create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  radius_m    int not null default 150 check (radius_m between 25 and 1000),
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  created_by  uuid references public.users (id) on delete set null,
  approved_by uuid references public.users (id) on delete set null,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- One-time migration of the old single gym setting.
insert into public.gyms (name, latitude, longitude, radius_m, status)
select gym_name, gym_latitude, gym_longitude, least(greatest(check_in_radius, 25), 1000), 'approved'
from public.settings
where id = 1 and gym_latitude is not null and gym_longitude is not null
  and not exists (select 1 from public.gyms);

-- ----------------------------------------------------------------------------
-- Check-ins (one row per verified visit — never continuous location)
-- ----------------------------------------------------------------------------
create table if not exists public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  latitude      double precision not null,
  longitude     double precision not null,
  accuracy      double precision,
  distance_m    double precision,
  gym_name      text not null,
  checked_in_at timestamptz not null default now()
);
-- radius in force when the check-in was verified (added later; nullable for old rows)
alter table public.check_ins add column if not exists radius_m int;
alter table public.check_ins add column if not exists gym_id uuid references public.gyms (id) on delete set null;
create index if not exists check_ins_user_time on public.check_ins (user_id, checked_in_at desc);
create index if not exists check_ins_time on public.check_ins (checked_in_at desc);

-- ----------------------------------------------------------------------------
-- Weeks + frozen results
-- ----------------------------------------------------------------------------
create table if not exists public.weeks (
  id           uuid primary key default gen_random_uuid(),
  start_date   date not null unique,          -- Monday (in settings.timezone)
  end_date     date not null,                 -- Sunday
  finalized_at timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.weekly_results (
  id             uuid primary key default gen_random_uuid(),
  week_id        uuid not null references public.weeks (id) on delete cascade,
  user_id        uuid not null references public.users (id) on delete cascade,
  check_in_count int not null,
  requirement    int not null,
  completed      boolean not null,
  punishment     text,                        -- null when completed
  created_at     timestamptz not null default now(),
  unique (week_id, user_id)
);

-- One group punishment per failed week: if anyone misses, everyone pays.
create table if not exists public.punishments (
  id           uuid primary key default gen_random_uuid(),
  week_id      uuid not null unique references public.weeks (id) on delete cascade,
  punishment   text not null,                 -- the agreed punishment at the time
  status       text not null default 'owed' check (status in ('owed', 'done')),
  completed_at timestamptz,
  completed_by uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.settings       enable row level security;
alter table public.check_ins      enable row level security;
alter table public.weeks          enable row level security;
alter table public.weekly_results enable row level security;
alter table public.punishments    enable row level security;
alter table public.gyms           enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_player() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid());
$$;

drop policy if exists "players read users" on public.users;
create policy "players read users" on public.users
  for select to authenticated using (public.is_player());

drop policy if exists "edit self or admin" on public.users;
create policy "edit self or admin" on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Only these columns are editable from the client (is_admin is not).
revoke update on public.users from authenticated;
grant update (name, avatar, color) on public.users to authenticated;

drop policy if exists "players read settings" on public.settings;
create policy "players read settings" on public.settings
  for select to authenticated using (public.is_player());

drop policy if exists "admins edit settings" on public.settings;
create policy "admins edit settings" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "players read check-ins" on public.check_ins;
create policy "players read check-ins" on public.check_ins
  for select to authenticated using (public.is_player());
-- No insert/update/delete policies: check-ins only enter through check_in().

drop policy if exists "players read weeks" on public.weeks;
create policy "players read weeks" on public.weeks
  for select to authenticated using (public.is_player());

drop policy if exists "players read gyms" on public.gyms;
create policy "players read gyms" on public.gyms
  for select to authenticated using (public.is_player());
-- No write policies: gyms change only through the gym functions below.

drop policy if exists "players read punishments" on public.punishments;
create policy "players read punishments" on public.punishments
  for select to authenticated using (public.is_player());
-- No write policies: status changes go through set_punishment_done().

drop policy if exists "players read results" on public.weekly_results;
create policy "players read results" on public.weekly_results
  for select to authenticated using (public.is_player());

-- ----------------------------------------------------------------------------
-- New auth user -> player profile
-- ----------------------------------------------------------------------------
create or replace function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  required_code text;
  palette text[] := array['#c8ff3d', '#3dd9ff', '#ff5c8a', '#b18cff', '#ffb547', '#4ade80'];
  n int;
begin
  select invite_code into required_code from app_private.config where id = 1;
  if coalesce(required_code, '') <> ''
     and coalesce(new.raw_user_meta_data ->> 'invite_code', '') <> required_code then
    raise exception 'Invalid invite code';
  end if;

  select count(*) into n from public.users;
  insert into public.users (id, name, avatar, color, is_admin)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 40),
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar', ''), '💪'),
    palette[(n % array_length(palette, 1)) + 1],
    n = 0                                   -- first player in becomes admin
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ----------------------------------------------------------------------------
-- Distance helper (meters, haversine)
-- ----------------------------------------------------------------------------
create or replace function public.distance_m(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ----------------------------------------------------------------------------
-- THE check-in. All validation happens here, not in the browser.
-- ----------------------------------------------------------------------------
create or replace function public.check_in(p_latitude double precision,
                                           p_longitude double precision,
                                           p_accuracy double precision default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  s    public.settings;
  d    double precision;
  last timestamptz;
  rec  public.check_ins;
  gym  record;
  pending_name text;
begin
  if uid is null then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if not exists (select 1 from public.users where id = uid) then
    return json_build_object('ok', false, 'code', 'no_profile');
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    return json_build_object('ok', false, 'code', 'invalid_location');
  end if;

  select * into s from public.settings where id = 1;

  -- Wildly imprecise fixes (IP-based desktop location etc.) are rejected.
  if p_accuracy is not null and p_accuracy > 1000 then
    return json_build_object('ok', false, 'code', 'low_accuracy', 'accuracy', round(p_accuracy));
  end if;

  if not exists (select 1 from public.gyms where status = 'approved' and not archived) then
    return json_build_object('ok', false, 'code', 'no_gym');
  end if;

  -- Nearest approved gym you're inside of; failing that, the nearest one.
  select g.*, public.distance_m(p_latitude, p_longitude, g.latitude, g.longitude) as d
    into gym
    from public.gyms g
   where g.status = 'approved' and not g.archived
   order by (public.distance_m(p_latitude, p_longitude, g.latitude, g.longitude) <= g.radius_m) desc,
            public.distance_m(p_latitude, p_longitude, g.latitude, g.longitude)
   limit 1;
  d := gym.d;

  if d > gym.radius_m then
    -- Standing in a gym that's still awaiting approval? Say so.
    select g.name into pending_name
      from public.gyms g
     where g.status = 'pending' and not g.archived
       and public.distance_m(p_latitude, p_longitude, g.latitude, g.longitude) <= g.radius_m
     limit 1;
    if pending_name is not null then
      return json_build_object('ok', false, 'code', 'gym_pending', 'gym_name', pending_name);
    end if;
    return json_build_object('ok', false, 'code', 'too_far',
                             'distance', round(d), 'radius', gym.radius_m, 'gym_name', gym.name);
  end if;

  -- Serialize per player so two fast taps can't both slip past the cooldown.
  perform pg_advisory_xact_lock(hashtext('check_in:' || uid::text));

  select max(checked_in_at) into last from public.check_ins where user_id = uid;
  if last is not null and last > now() - make_interval(secs => s.cooldown_hours * 3600) then
    return json_build_object('ok', false, 'code', 'cooldown',
                             'next_allowed_at', last + make_interval(secs => s.cooldown_hours * 3600));
  end if;

  insert into public.check_ins (user_id, latitude, longitude, accuracy, distance_m, radius_m, gym_id, gym_name)
  values (uid, p_latitude, p_longitude, p_accuracy, round(d::numeric, 1), gym.radius_m, gym.id, gym.name)
  returning * into rec;

  return json_build_object('ok', true, 'check_in', row_to_json(rec));
end $$;

revoke all on function public.check_in(double precision, double precision, double precision) from public, anon;
grant execute on function public.check_in(double precision, double precision, double precision) to authenticated;

-- ----------------------------------------------------------------------------
-- Weekly rollover. Freezes every finished Monday→Sunday week into
-- weekly_results (count, pass/fail, the punishment in force at the time).
-- Idempotent and safe to call concurrently; the app calls it on load and you
-- can also schedule it with pg_cron (see README).
-- ----------------------------------------------------------------------------
create or replace function public.finalize_past_weeks() returns int
language plpgsql security definer set search_path = public as $$
declare
  s          public.settings;
  cur_week   date;
  wk         date;
  first_day  date;
  wid        uuid;
  n          int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('finalize_past_weeks'));
  select * into s from public.settings where id = 1;

  cur_week := date_trunc('week', now() at time zone s.timezone)::date;   -- Monday
  select min((created_at at time zone s.timezone)::date) into first_day from public.users;
  if first_day is null then return 0; end if;

  wk := date_trunc('week', first_day)::date;
  while wk < cur_week loop
    if not exists (select 1 from public.weeks where start_date = wk and finalized_at is not null) then
      insert into public.weeks (start_date, end_date, finalized_at)
      values (wk, wk + 6, now())
      on conflict (start_date) do update set finalized_at = coalesce(public.weeks.finalized_at, now())
      returning id into wid;

      insert into public.weekly_results (week_id, user_id, check_in_count, requirement, completed, punishment)
      select wid, u.id, count(c.id), s.weekly_requirement,
             count(c.id) >= s.weekly_requirement,
             case when count(c.id) < s.weekly_requirement then s.punishment end
      from public.users u
      left join public.check_ins c
        on c.user_id = u.id
       and (c.checked_in_at at time zone s.timezone) >= wk
       and (c.checked_in_at at time zone s.timezone) <  wk + 7
      -- the week you join is a warm-up unless you joined on the Monday
      where (u.created_at at time zone s.timezone)::date <= wk
      group by u.id
      on conflict (week_id, user_id) do nothing;

      -- Anyone short → the whole group owes the punishment.
      insert into public.punishments (week_id, punishment)
      select wid, s.punishment
      where exists (select 1 from public.weekly_results r where r.week_id = wid and not r.completed)
      on conflict (week_id) do nothing;

      n := n + 1;
    end if;
    wk := wk + 7;
  end loop;
  return n;
end $$;

revoke all on function public.finalize_past_weeks() from public, anon;
grant execute on function public.finalize_past_weeks() to authenticated;

-- ----------------------------------------------------------------------------
-- Gym management
-- ----------------------------------------------------------------------------
create or replace function public.add_gym(p_name text, p_latitude double precision,
                                          p_longitude double precision, p_radius int default 150)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec public.gyms;
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if (select count(*) from public.gyms where not archived) >= 25 then
    return json_build_object('ok', false, 'code', 'too_many');
  end if;
  insert into public.gyms (name, latitude, longitude, radius_m, status, created_by, approved_by)
  values (trim(p_name), p_latitude, p_longitude, p_radius,
          case when public.is_admin() then 'approved' else 'pending' end,
          uid,
          case when public.is_admin() then uid end)
  returning * into rec;
  return json_build_object('ok', true, 'gym', row_to_json(rec));
end $$;

-- Someone other than the person who added it has to vouch for a gym.
create or replace function public.approve_gym(p_gym uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g   public.gyms;
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into g from public.gyms where id = p_gym and not archived;
  if g.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  if g.created_by = uid then return json_build_object('ok', false, 'code', 'own_gym'); end if;
  update public.gyms set status = 'approved', approved_by = uid where id = p_gym;
  return json_build_object('ok', true);
end $$;

-- Admin can edit any gym; the creator can edit theirs only while pending
-- (moving an approved gym would let someone relocate it to their couch).
create or replace function public.update_gym(p_gym uuid, p_name text, p_latitude double precision,
                                             p_longitude double precision, p_radius int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g   public.gyms;
begin
  select * into g from public.gyms where id = p_gym and not archived;
  if g.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  if not (public.is_admin() or (g.created_by = uid and g.status = 'pending')) then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  update public.gyms
     set name = trim(p_name), latitude = p_latitude, longitude = p_longitude, radius_m = p_radius
   where id = p_gym;
  return json_build_object('ok', true);
end $$;

-- Archive instead of delete so past check-ins keep their gym.
create or replace function public.archive_gym(p_gym uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g   public.gyms;
begin
  select * into g from public.gyms where id = p_gym and not archived;
  if g.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  if not (public.is_admin() or g.created_by = uid) then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  update public.gyms set archived = true where id = p_gym;
  return json_build_object('ok', true);
end $$;

revoke all on function public.add_gym(text, double precision, double precision, int) from public, anon;
revoke all on function public.approve_gym(uuid) from public, anon;
revoke all on function public.update_gym(uuid, text, double precision, double precision, int) from public, anon;
revoke all on function public.archive_gym(uuid) from public, anon;
grant execute on function public.add_gym(text, double precision, double precision, int) to authenticated;
grant execute on function public.approve_gym(uuid) to authenticated;
grant execute on function public.update_gym(uuid, text, double precision, double precision, int) to authenticated;
grant execute on function public.archive_gym(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Punishment tracker: any player can mark the group punishment done (or undo).
-- ----------------------------------------------------------------------------
create or replace function public.set_punishment_done(p_week_start date, p_done boolean)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec public.punishments;
begin
  if uid is null or not exists (select 1 from public.users where id = uid) then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  perform public.finalize_past_weeks();

  update public.punishments p
     set status       = case when p_done then 'done' else 'owed' end,
         completed_at = case when p_done then now() end,
         completed_by = case when p_done then uid end
    from public.weeks w
   where w.id = p.week_id and w.start_date = p_week_start
  returning p.* into rec;

  if rec.id is null then
    return json_build_object('ok', false, 'code', 'not_found');
  end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.set_punishment_done(date, boolean) from public, anon;
grant execute on function public.set_punishment_done(date, boolean) to authenticated;

-- Backfill: weeks finalized before the tracker existed.
insert into public.punishments (week_id, punishment)
select w.id, coalesce(max(r.punishment), (select punishment from public.settings where id = 1))
from public.weeks w
join public.weekly_results r on r.week_id = w.id
group by w.id
having bool_or(not r.completed)
on conflict (week_id) do nothing;

-- ----------------------------------------------------------------------------
-- Live updates for the dashboard
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.check_ins;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.punishments;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.gyms;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
