-- ============================================================================
-- Club owner + admins. Already part of schema.sql; run this file once if you
-- set up the database before it existed. Idempotent.
--
-- Owner (one person): everything. Admins: their own gyms approved instantly,
-- approve/turn down pending gyms, pause other players, delete chat messages.
-- Owner only: club rules, admins, personal goals, manual check-ins, moving or
-- removing approved gyms, editing other players' profiles.
-- ============================================================================

-- The club owner: one person with full control. Admins are helpers with a
-- smaller set of powers (approving gyms, pausing others, tidying the chat).
alter table public.users add column if not exists is_owner boolean not null default false;
create unique index if not exists users_one_owner on public.users ((true)) where is_owner;
-- Existing clubs: the longest-standing admin (else the first player) is the owner.
update public.users set is_owner = true, is_admin = true
 where id = (select id from public.users order by is_admin desc, created_at, id limit 1)
   and not exists (select 1 from public.users where is_owner);


create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.users where id = auth.uid()), false);
$$;

-- New sign-ups: the very first player is the owner.
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
  insert into public.users (id, name, avatar, color, is_admin, is_owner)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 40),
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar', ''), '💪'),
    palette[(n % array_length(palette, 1)) + 1],
    n = 0,                                  -- first player in is the owner (and an admin)
    n = 0
  );
  return new;
end $$;

-- Only the owner edits other players' profiles and the club settings.
drop policy if exists "edit self or admin" on public.users;
drop policy if exists "edit self or owner" on public.users;
create policy "edit self or owner" on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

drop policy if exists "admins edit settings" on public.settings;
drop policy if exists "owner edits settings" on public.settings;
create policy "owner edits settings" on public.settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Approved gyms: only the owner moves them. Admins handle pending ones.
create or replace function public.update_gym(p_gym uuid, p_name text, p_latitude double precision,
                                             p_longitude double precision, p_radius int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g   public.gyms;
begin
  select * into g from public.gyms where id = p_gym and not archived;
  if g.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  -- Pending gyms: their creator or an admin. Approved gyms: only the owner can move them.
  if not (public.is_owner() or (g.status = 'pending' and (public.is_admin() or g.created_by = uid))) then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  update public.gyms
     set name = trim(p_name), latitude = p_latitude, longitude = p_longitude, radius_m = p_radius
   where id = p_gym;
  return json_build_object('ok', true);
end $$;

create or replace function public.archive_gym(p_gym uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g   public.gyms;
begin
  select * into g from public.gyms where id = p_gym and not archived;
  if g.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  -- Owner: any. Admin: pending ones (turn down a bad request). Anyone: their own.
  if not (public.is_owner() or g.created_by = uid or (public.is_admin() and g.status = 'pending')) then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  update public.gyms set archived = true where id = p_gym;
  return json_build_object('ok', true);
end $$;

-- Personal weekly goals: owner only.
create or replace function public.set_player_requirement(p_user uuid, p_requirement int)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_requirement is not null and p_requirement not between 1 and 14 then
    return json_build_object('ok', false, 'code', 'bad_requirement');
  end if;
  update public.users set weekly_requirement = p_requirement where id = p_user;
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  return json_build_object('ok', true);
end $$;

-- Pausing: admins can pause anyone except themselves and the owner.
create or replace function public.set_player_paused(p_user uuid, p_paused boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  -- Admins can't pause themselves (no dodging a punishment) or the owner.
  if not public.is_owner()
     and (p_user = auth.uid() or exists (select 1 from public.users where id = p_user and is_owner)) then
    return json_build_object('ok', false, 'code', 'not_allowed');
  end if;
  update public.users set paused = coalesce(p_paused, false) where id = p_user;
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  return json_build_object('ok', true);
end $$;

-- Owner: make someone an admin, or take it away. The owner is always an admin.
create or replace function public.set_player_admin(p_user uuid, p_admin boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  if not exists (select 1 from public.users where id = p_user) then
    return json_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from public.users where id = p_user and is_owner) then
    return json_build_object('ok', false, 'code', 'owner');
  end if;
  update public.users set is_admin = coalesce(p_admin, false) where id = p_user;
  return json_build_object('ok', true);
end $$;
revoke all on function public.set_player_admin(uuid, boolean) from public, anon;
grant execute on function public.set_player_admin(uuid, boolean) to authenticated;

-- Manual check-ins: owner only.
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
  if not public.is_owner() then
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

create or replace function public.admin_remove_check_in(p_check_in uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  s   public.settings;
  rec public.check_ins;
begin
  if not public.is_owner() then
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
