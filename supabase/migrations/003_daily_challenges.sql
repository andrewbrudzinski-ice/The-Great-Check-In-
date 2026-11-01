-- ============================================================================
-- Daily challenges (e.g. 100 pushups a day). Already part of schema.sql; run
-- this file once if you set up the database before it existed. Idempotent.
-- ============================================================================

create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 40),
  emoji        text not null default '💪' check (char_length(emoji) between 1 and 16),
  daily_target int  not null check (daily_target between 1 and 100000),
  unit         text not null default 'reps' check (char_length(unit) between 1 and 20),
  archived     boolean not null default false,
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- One row per logged set. `day` is the club-timezone date it counts for and
-- `target` is the challenge's target at the time, so changing the target
-- later doesn't rewrite past days.
create table if not exists public.challenge_logs (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  amount       int  not null check (amount between 1 and 100000),
  target       int  not null,
  day          date not null,
  logged_at    timestamptz not null default now()
);
create index if not exists challenge_logs_day on public.challenge_logs (challenge_id, day);
create index if not exists challenge_logs_user on public.challenge_logs (user_id, day);

alter table public.challenges     enable row level security;
alter table public.challenge_logs enable row level security;

drop policy if exists "players read challenges" on public.challenges;
create policy "players read challenges" on public.challenges
  for select to authenticated using (public.is_player());
drop policy if exists "players read challenge logs" on public.challenge_logs;
create policy "players read challenge logs" on public.challenge_logs
  for select to authenticated using (public.is_player());
-- No write policies: everything goes through the functions below.

-- Start everyone off with the one the group asked for (only on a fresh install).
insert into public.challenges (name, emoji, daily_target, unit)
select 'Pushups', '💪', 100, 'reps'
where not exists (select 1 from public.challenges);

-- Log a set for yourself, today (club timezone).
create or replace function public.log_challenge(p_challenge uuid, p_amount int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c   public.challenges;
  tz  text;
  rec public.challenge_logs;
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into c from public.challenges where id = p_challenge and not archived;
  if c.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    return json_build_object('ok', false, 'code', 'bad_amount');
  end if;
  select timezone into tz from public.settings where id = 1;
  insert into public.challenge_logs (challenge_id, user_id, amount, target, day)
  values (c.id, uid, p_amount, c.daily_target, (now() at time zone tz)::date)
  returning * into rec;
  return json_build_object('ok', true, 'log', row_to_json(rec));
end $$;

-- Undo one of your own sets from today or yesterday (fat-finger fixes).
create or replace function public.delete_challenge_log(p_log uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tz  text;
  n   int;
begin
  select timezone into tz from public.settings where id = 1;
  delete from public.challenge_logs
   where id = p_log and user_id = uid
     and day >= (now() at time zone tz)::date - 1;
  get diagnostics n = row_count;
  if n = 0 then return json_build_object('ok', false, 'code', 'not_found'); end if;
  return json_build_object('ok', true);
end $$;

-- Any player can add a challenge or change one (name, emoji, target, unit).
create or replace function public.save_challenge(p_id uuid, p_name text, p_emoji text,
                                                 p_target int, p_unit text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec public.challenges;
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if p_id is null then
    if (select count(*) from public.challenges where not archived) >= 10 then
      return json_build_object('ok', false, 'code', 'too_many');
    end if;
    insert into public.challenges (name, emoji, daily_target, unit, created_by)
    values (trim(p_name), coalesce(nullif(trim(p_emoji), ''), '💪'), p_target, coalesce(nullif(trim(p_unit), ''), 'reps'), uid)
    returning * into rec;
  else
    update public.challenges
       set name = trim(p_name), emoji = coalesce(nullif(trim(p_emoji), ''), emoji),
           daily_target = p_target, unit = coalesce(nullif(trim(p_unit), ''), unit)
     where id = p_id and not archived
    returning * into rec;
    if rec.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  end if;
  return json_build_object('ok', true, 'challenge', row_to_json(rec));
end $$;

-- Retire a challenge. History is kept.
create or replace function public.archive_challenge(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  update public.challenges set archived = true where id = p_id and not archived;
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.log_challenge(uuid, int) from public, anon;
revoke all on function public.delete_challenge_log(uuid) from public, anon;
revoke all on function public.save_challenge(uuid, text, text, int, text) from public, anon;
revoke all on function public.archive_challenge(uuid) from public, anon;
grant execute on function public.log_challenge(uuid, int) to authenticated;
grant execute on function public.delete_challenge_log(uuid) to authenticated;
grant execute on function public.save_challenge(uuid, text, text, int, text) to authenticated;
grant execute on function public.archive_challenge(uuid) to authenticated;

-- Live updates when a friend logs a set.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.challenge_logs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.challenges;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
