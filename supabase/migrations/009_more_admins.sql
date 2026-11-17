-- ============================================================================
-- More than one admin. Already part of schema.sql; run this file once if you
-- set up the database before it existed. Idempotent.
-- ============================================================================

-- Admin: make someone an admin, or take it away. The club always keeps at
-- least one admin (you can step down once someone else is one).
create or replace function public.set_player_admin(p_user uuid, p_admin boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'code', 'forbidden');
  end if;
  -- Lock the admins so two people can't demote each other at the same moment.
  perform 1 from public.users where is_admin for update;
  if not exists (select 1 from public.users where id = p_user) then
    return json_build_object('ok', false, 'code', 'not_found');
  end if;
  if not coalesce(p_admin, false)
     and not exists (select 1 from public.users where is_admin and id <> p_user) then
    return json_build_object('ok', false, 'code', 'last_admin');
  end if;
  update public.users set is_admin = coalesce(p_admin, false) where id = p_user;
  return json_build_object('ok', true);
end $$;
revoke all on function public.set_player_admin(uuid, boolean) from public, anon;
grant execute on function public.set_player_admin(uuid, boolean) to authenticated;
