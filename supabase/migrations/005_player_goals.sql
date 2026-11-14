-- ============================================================================
-- Per-player weekly goals. Already part of schema.sql; run this file once if
-- you set up the database before it existed. Idempotent.
-- ============================================================================

-- Per-player weekly goal (e.g. 3 instead of the club's 5). Null = club default.
alter table public.users add column if not exists weekly_requirement int
  check (weekly_requirement between 1 and 14);

create or replace function public.set_player_requirement(p_user uuid, p_requirement int)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_requirement is not null and p_requirement not between 1 and 14 then
    return json_build_object('ok', false, 'code', 'bad_requirement');
  end if;
  update public.users set weekly_requirement = p_requirement where id = p_user;
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  return json_build_object('ok', true);
end $$;
revoke all on function public.set_player_requirement(uuid, int) from public, anon;
grant execute on function public.set_player_requirement(uuid, int) to authenticated;

-- Weekly close-out now uses each player's own goal.
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
      select wid, u.id, count(c.id), coalesce(u.weekly_requirement, s.weekly_requirement),
             count(c.id) >= coalesce(u.weekly_requirement, s.weekly_requirement),
             case when count(c.id) < coalesce(u.weekly_requirement, s.weekly_requirement) then s.punishment end
      from public.users u
      left join public.check_ins c
        on c.user_id = u.id
       and (c.checked_in_at at time zone s.timezone) >= wk
       and (c.checked_in_at at time zone s.timezone) <  wk + 7
      -- the week you join is a warm-up unless you joined on the Monday
      where (u.created_at at time zone s.timezone)::date <= wk
      group by u.id, u.weekly_requirement
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
