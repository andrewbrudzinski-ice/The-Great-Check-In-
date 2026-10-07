-- Adds admin manual check-ins to an existing install.
-- (Already included in schema.sql; only needed if you ran schema.sql before this existed.)

-- Admin-added check-ins (someone forgot): no GPS, clearly labelled.
alter table public.check_ins add column if not exists manual boolean not null default false;
alter table public.check_ins add column if not exists added_by uuid references public.users (id) on delete set null;
alter table public.check_ins add column if not exists note text check (char_length(note) <= 140);

-- ----------------------------------------------------------------------------
-- Admin manual check-ins (for when someone forgot to tap the button)
-- ----------------------------------------------------------------------------

-- Re-count an already-frozen week after a manual add/remove, and keep the
-- group punishment in sync (fixing the only miss clears an owed punishment).
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
         punishment     = case when sub.n >= r.requirement then null
                               else coalesce(r.punishment, s.punishment) end
    from (select u.id as user_id, count(c.id) as n
            from public.users u
            left join public.check_ins c
              on c.user_id = u.id
             and (c.checked_in_at at time zone s.timezone) >= p_week
             and (c.checked_in_at at time zone s.timezone) <  p_week + 7
           group by u.id) sub
   where r.week_id = wid and r.user_id = sub.user_id;

  if exists (select 1 from public.weekly_results where week_id = wid and not completed) then
    insert into public.punishments (week_id, punishment)
    values (wid, coalesce((select max(punishment) from public.weekly_results where week_id = wid), s.punishment))
    on conflict (week_id) do nothing;
  else
    delete from public.punishments where week_id = wid and status = 'owed';
  end if;
end $$;
revoke all on function app_private.refreeze_week(date) from public, anon, authenticated;

create or replace function public.admin_check_in(p_user uuid, p_gym uuid,
                                                 p_at timestamptz default null, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  at_ts timestamptz := coalesce(p_at, now());
  s     public.settings;
  g     public.gyms;
  clash timestamptz;
  rec   public.check_ins;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  if not exists (select 1 from public.users where id = p_user) then
    return json_build_object('ok', false, 'code', 'no_player');
  end if;
  select * into g from public.gyms where id = p_gym and status = 'approved' and not archived;
  if g.id is null then
    return json_build_object('ok', false, 'code', 'no_gym');
  end if;
  if at_ts > now() + interval '5 minutes' then
    return json_build_object('ok', false, 'code', 'future');
  end if;
  if at_ts < now() - interval '14 days' then
    return json_build_object('ok', false, 'code', 'too_old');
  end if;

  select * into s from public.settings where id = 1;
  perform pg_advisory_xact_lock(hashtext('check_in:' || p_user::text));

  -- Same cooldown as a normal check-in, in either direction, so the same
  -- visit can't be counted twice.
  select checked_in_at into clash
    from public.check_ins
   where user_id = p_user
     and abs(extract(epoch from checked_in_at - at_ts)) < s.cooldown_hours * 3600
   limit 1;
  if clash is not null then
    return json_build_object('ok', false, 'code', 'duplicate', 'existing_at', clash);
  end if;

  insert into public.check_ins (user_id, latitude, longitude, accuracy, distance_m, radius_m,
                                gym_id, gym_name, checked_in_at, manual, added_by, note)
  values (p_user, g.latitude, g.longitude, null, null, g.radius_m,
          g.id, g.name, at_ts, true, uid, nullif(trim(p_note), ''))
  returning * into rec;

  perform app_private.refreeze_week(date_trunc('week', at_ts at time zone s.timezone)::date);
  return json_build_object('ok', true, 'check_in', row_to_json(rec));
end $$;

-- Undo a manual check-in added by mistake. GPS check-ins can't be removed.
create or replace function public.admin_remove_check_in(p_check_in uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  s   public.settings;
  rec public.check_ins;
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  delete from public.check_ins where id = p_check_in and manual returning * into rec;
  if rec.id is null then
    return json_build_object('ok', false, 'code', 'not_found');
  end if;
  select * into s from public.settings where id = 1;
  perform app_private.refreeze_week(date_trunc('week', rec.checked_in_at at time zone s.timezone)::date);
  return json_build_object('ok', true);
end $$;

revoke all on function public.admin_check_in(uuid, uuid, timestamptz, text) from public, anon;
revoke all on function public.admin_remove_check_in(uuid) from public, anon;
grant execute on function public.admin_check_in(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.admin_remove_check_in(uuid) to authenticated;
