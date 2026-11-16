-- ============================================================================
-- Random daily challenge. Already part of schema.sql; run this file once if
-- you set up the database before it existed. Idempotent.
-- ============================================================================

-- Whether the club does one random challenge a day (same for everyone) or
-- every challenge every day. sort_order is just the order they're listed in.
alter table public.challenges add column if not exists sort_order int not null default 0;
alter table public.settings add column if not exists challenge_rotation boolean not null default true;

-- The day's pick, saved the first time anyone opens the app that day, so it
-- can't change under people once they've started.
create table if not exists public.challenge_days (
  day          date primary key,
  challenge_id uuid not null references public.challenges(id),
  picked_at    timestamptz not null default now()
);
alter table public.challenge_days enable row level security;
drop policy if exists "players read challenge days" on public.challenge_days;
create policy "players read challenge days" on public.challenge_days
  for select to authenticated using (public.is_player());
-- No write policies: only todays_challenge() writes.

-- The club's calendar day right now.
create or replace function public.club_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone timezone)::date from public.settings where id = 1;
$$;

-- Today's challenge: the saved pick, or a fresh random one (never yesterday's
-- when there's a choice). Re-picks if today's was retired. Null when the club
-- does every challenge every day, or has none.
create or replace function public.todays_challenge() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  today date := public.club_today();
  cur   uuid;
  prev  uuid;
begin
  if not coalesce((select challenge_rotation from public.settings where id = 1), false) then
    return null;
  end if;
  select d.challenge_id into cur
    from public.challenge_days d join public.challenges c on c.id = d.challenge_id
   where d.day = today and not c.archived;
  if cur is not null then return cur; end if;

  select challenge_id into prev from public.challenge_days where day = today - 1;
  select id into cur from public.challenges where not archived
   order by (id = prev) nulls first, random() limit 1;
  if cur is null then return null; end if;

  insert into public.challenge_days (day, challenge_id) values (today, cur)
  on conflict (day) do update set challenge_id = excluded.challenge_id, picked_at = now()
   where not exists (select 1 from public.challenges c where c.id = public.challenge_days.challenge_id and not c.archived);
  -- Someone else may have picked a moment earlier: theirs wins.
  select challenge_id into cur from public.challenge_days where day = today;
  return cur;
end $$;

-- Add the group's new ones (skip any that already exist by name).
insert into public.challenges (name, emoji, daily_target, unit)
select v.name, v.emoji, v.target, v.unit
from (values ('Sit-ups', '🤸', 100, 'reps'), ('Burpees', '🔥', 50, 'reps'), ('Abs', '⏱️', 10, 'min')) as v(name, emoji, target, unit)
where not exists (select 1 from public.challenges c where lower(c.name) = lower(v.name) and not c.archived);

-- First time only: list them Pushups, Sit-ups, Burpees, Abs, then anything else.
do $$
begin
  if not exists (select 1 from public.challenges where sort_order <> 0) then
    update public.challenges c
       set sort_order = o.rn
      from (select id, row_number() over (
              order by case lower(name) when 'pushups' then 0 when 'sit-ups' then 1 when 'burpees' then 2 when 'abs' then 3 else 4 end,
                       created_at) as rn
              from public.challenges) o
     where c.id = o.id;
  end if;
end $$;

-- Log a set for yourself, today. In random mode only today's challenge counts.
create or replace function public.log_challenge(p_challenge uuid, p_amount int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  c     public.challenges;
  s     public.settings;
  today date;
  rec   public.challenge_logs;
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  select * into c from public.challenges where id = p_challenge and not archived;
  if c.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    return json_build_object('ok', false, 'code', 'bad_amount');
  end if;
  select * into s from public.settings where id = 1;
  today := (now() at time zone s.timezone)::date;
  if s.challenge_rotation and c.id is distinct from public.todays_challenge() then
    return json_build_object('ok', false, 'code', 'not_today');
  end if;
  insert into public.challenge_logs (challenge_id, user_id, amount, target, day)
  values (c.id, uid, p_amount, c.daily_target, today)
  returning * into rec;
  return json_build_object('ok', true, 'log', row_to_json(rec));
end $$;

-- Add or edit a challenge. New ones are listed last.
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
    insert into public.challenges (name, emoji, daily_target, unit, created_by, sort_order)
    values (trim(p_name), coalesce(nullif(trim(p_emoji), ''), '💪'), p_target, coalesce(nullif(trim(p_unit), ''), 'reps'), uid,
            coalesce((select max(sort_order) + 1 from public.challenges), 0))
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

-- Retire a challenge (history kept). If it was today's, a new one gets picked.
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

-- Clean up the fixed-order rotation from an earlier draft of this file.
drop function if exists public.set_challenge_order(uuid[]);
drop function if exists public.rotation_pin(uuid, int);
drop function if exists public.rotation_index_of(uuid);
drop function if exists public.rotation_challenge_for(date);
alter table public.settings drop column if exists rotation_anchor_day;
alter table public.settings drop column if exists rotation_anchor_index;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.challenge_days;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

revoke all on table public.challenge_days from anon;
grant select on table public.challenge_days to authenticated;
revoke all on function public.club_today() from public, anon;
revoke all on function public.todays_challenge() from public, anon;
grant execute on function public.club_today() to authenticated;
grant execute on function public.todays_challenge() to authenticated;
revoke all on function public.log_challenge(uuid, int) from public, anon;
revoke all on function public.save_challenge(uuid, text, text, int, text) from public, anon;
revoke all on function public.archive_challenge(uuid) from public, anon;
grant execute on function public.log_challenge(uuid, int) to authenticated;
grant execute on function public.save_challenge(uuid, text, text, int, text) to authenticated;
grant execute on function public.archive_challenge(uuid) to authenticated;
