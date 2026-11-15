-- ============================================================================
-- Pause players. Already part of schema.sql; run this file once if you set up
-- the database before it existed. Idempotent.
-- ============================================================================

alter table public.users add column if not exists paused boolean not null default false;
alter table public.weekly_results add column if not exists exempt boolean not null default false;

create or replace function public.set_player_paused(p_user uuid, p_paused boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  update public.users set paused = coalesce(p_paused, false) where id = p_user;
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  return json_build_object('ok', true);
end $$;
revoke all on function public.set_player_paused(uuid, boolean) from public, anon;
grant execute on function public.set_player_paused(uuid, boolean) to authenticated;

-- Weekly close-out: record paused players as exempt; they never trigger the punishment.
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

      insert into public.weekly_results (week_id, user_id, check_in_count, requirement, completed, punishment, exempt)
      select wid, u.id, count(c.id), coalesce(u.weekly_requirement, s.weekly_requirement),
             count(c.id) >= coalesce(u.weekly_requirement, s.weekly_requirement),
             case when count(c.id) < coalesce(u.weekly_requirement, s.weekly_requirement) and not u.paused then s.punishment end,
             u.paused
      from public.users u
      left join public.check_ins c
        on c.user_id = u.id
       and (c.checked_in_at at time zone s.timezone) >= wk
       and (c.checked_in_at at time zone s.timezone) <  wk + 7
      -- the week you join is a warm-up unless you joined on the Monday
      where (u.created_at at time zone s.timezone)::date <= wk
      group by u.id, u.weekly_requirement, u.paused
      on conflict (week_id, user_id) do nothing;

      -- Anyone short (and not paused) → the whole group owes the punishment.
      insert into public.punishments (week_id, punishment)
      select wid, s.punishment
      where exists (select 1 from public.weekly_results r where r.week_id = wid and not r.completed and not r.exempt)
      on conflict (week_id) do nothing;

      n := n + 1;
    end if;
    wk := wk + 7;
  end loop;
  return n;
end $$;

-- Re-count after a manual check-in: exempt rows never count as a miss.
create or replace function app_private.refreeze_week(p_week date) returns void
language plpgsql security definer set search_path = public as $$
declare
  s   public.settings;
  wid uuid;
begin
  select * into s from public.settings where id = 1;
  select id into wid from public.weeks where start_date = p_week and finalized_at is not null;
  if wid is null then return; end if;   -- still the live week: nothing frozen yet

  update public.weekly_results r
     set check_in_count = sub.n,
         completed      = sub.n >= r.requirement,
         punishment     = case when sub.n >= r.requirement or r.exempt then null
                               else coalesce(r.punishment, s.punishment) end
    from (select u.id as user_id, count(c.id) as n
            from public.users u
            left join public.check_ins c
              on c.user_id = u.id
             and (c.checked_in_at at time zone s.timezone) >= p_week
             and (c.checked_in_at at time zone s.timezone) <  p_week + 7
           group by u.id) sub
   where r.week_id = wid and r.user_id = sub.user_id;

  if exists (select 1 from public.weekly_results where week_id = wid and not completed and not exempt) then
    insert into public.punishments (week_id, punishment)
    values (wid, coalesce((select max(punishment) from public.weekly_results where week_id = wid), s.punishment))
    on conflict (week_id) do nothing;
  else
    delete from public.punishments where week_id = wid and status = 'owed';
  end if;
end $$;
revoke all on function app_private.refreeze_week(date) from public, anon, authenticated;
