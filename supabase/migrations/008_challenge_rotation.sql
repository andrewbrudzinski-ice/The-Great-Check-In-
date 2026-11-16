-- ============================================================================
-- Rotating daily challenge. Already part of schema.sql; run this file once if
-- you set up the database before it existed. Idempotent.
-- ============================================================================

-- Order of the rotation, and whether the club rotates (one challenge a day,
-- same for everyone) or does every challenge every day.
alter table public.challenges add column if not exists sort_order int not null default 0;
alter table public.settings add column if not exists challenge_rotation boolean not null default true;
-- On anchor_day the rotation is at position anchor_index, then +1 a day.
-- Re-pinned whenever the list changes so today's challenge never jumps.
alter table public.settings add column if not exists rotation_anchor_day date not null default date '2024-01-01';
alter table public.settings add column if not exists rotation_anchor_index int not null default 0;

-- The challenge on the rotation for a day (null if there are none). Must
-- match rotationFor() in src/lib/challenges.ts.
create or replace function public.rotation_challenge_for(p_day date) returns uuid
language sql stable security definer set search_path = public as $$
  with pool as (
    select id, row_number() over (order by sort_order, created_at, id) - 1 as i, count(*) over () as n
    from public.challenges where not archived
  ), s as (select rotation_anchor_day d, rotation_anchor_index a from public.settings where id = 1)
  select pool.id from pool, s
  where pool.i = (((s.a + (p_day - s.d)) % pool.n) + pool.n) % pool.n;
$$;

-- 0-based place of a challenge in the rotation (null if not in it).
create or replace function public.rotation_index_of(p_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select i::int from (
    select id, row_number() over (order by sort_order, created_at, id) - 1 as i
    from public.challenges where not archived
  ) pool where pool.id = p_id;
$$;

-- The club's calendar day right now.
create or replace function public.club_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone timezone)::date from public.settings where id = 1;
$$;

-- After the list changes: keep today's challenge where it was. If it was
-- retired, whatever now sits in its place takes over today.
create or replace function public.rotation_pin(p_keep uuid, p_old_pos int) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.settings
     set rotation_anchor_day = public.club_today(),
         rotation_anchor_index = coalesce(public.rotation_index_of(p_keep), p_old_pos, 0)
   where id = 1;
end $$;

-- Add the group's new ones (skip any that already exist by name).
insert into public.challenges (name, emoji, daily_target, unit)
select v.name, v.emoji, v.target, v.unit
from (values ('Sit-ups', '🤸', 100, 'reps'), ('Burpees', '🔥', 50, 'reps'), ('Abs', '⏱️', 10, 'min')) as v(name, emoji, target, unit)
where not exists (select 1 from public.challenges c where lower(c.name) = lower(v.name) and not c.archived);

-- First time only: order Pushups → Sit-ups → Burpees → Abs → anything else,
-- and start the rotation at the top today.
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
    update public.settings set rotation_anchor_day = public.club_today(), rotation_anchor_index = 0 where id = 1;
  end if;
end $$;

-- Log a set for yourself, today. While rotating, only today's challenge counts.
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
  if s.challenge_rotation and c.id is distinct from public.rotation_challenge_for(today) then
    return json_build_object('ok', false, 'code', 'not_today');
  end if;
  insert into public.challenge_logs (challenge_id, user_id, amount, target, day)
  values (c.id, uid, p_amount, c.daily_target, today)
  returning * into rec;
  return json_build_object('ok', true, 'log', row_to_json(rec));
end $$;

-- New challenges join the end of the rotation.
create or replace function public.save_challenge(p_id uuid, p_name text, p_emoji text,
                                                 p_target int, p_unit text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  rec  public.challenges;
  keep uuid := public.rotation_challenge_for(public.club_today());
  pos  int := public.rotation_index_of(keep);
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
    perform public.rotation_pin(keep, pos);
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

-- Reorder the rotation: pass every active challenge id in the new order.
-- Today's challenge stays; the new order takes over from tomorrow.
create or replace function public.set_challenge_order(p_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
declare
  keep uuid := public.rotation_challenge_for(public.club_today());
  pos  int := public.rotation_index_of(keep);
begin
  if auth.uid() is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  update public.challenges c set sort_order = o.i
    from unnest(p_ids) with ordinality as o(id, i)
   where c.id = o.id;
  perform public.rotation_pin(keep, pos);
  return json_build_object('ok', true);
end $$;

-- Retire a challenge (history kept). If it was today's, the next one in line takes over.
create or replace function public.archive_challenge(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  keep uuid := public.rotation_challenge_for(public.club_today());
  pos  int := public.rotation_index_of(keep);
begin
  if auth.uid() is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  update public.challenges set archived = true where id = p_id and not archived;
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  perform public.rotation_pin(keep, pos);
  return json_build_object('ok', true);
end $$;

revoke all on function public.rotation_challenge_for(date) from public, anon;
revoke all on function public.rotation_index_of(uuid) from public, anon;
revoke all on function public.club_today() from public, anon;
revoke all on function public.rotation_pin(uuid, int) from public, anon, authenticated;
grant execute on function public.rotation_index_of(uuid) to authenticated;
grant execute on function public.club_today() to authenticated;
revoke all on function public.set_challenge_order(uuid[]) from public, anon;
grant execute on function public.rotation_challenge_for(date) to authenticated;
grant execute on function public.set_challenge_order(uuid[]) to authenticated;
revoke all on function public.log_challenge(uuid, int) from public, anon;
revoke all on function public.save_challenge(uuid, text, text, int, text) from public, anon;
grant execute on function public.log_challenge(uuid, int) to authenticated;
grant execute on function public.save_challenge(uuid, text, text, int, text) to authenticated;
revoke all on function public.archive_challenge(uuid) from public, anon;
grant execute on function public.archive_challenge(uuid) to authenticated;
