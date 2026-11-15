-- ============================================================================
-- Club chat. Already part of schema.sql; run this file once if you set up the
-- database before it existed. Idempotent.
-- ============================================================================

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  deleted    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_time on public.messages (created_at desc);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '🔥', '😂', '💀', '💪', '❤️')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "players read messages" on public.messages;
create policy "players read messages" on public.messages
  for select to authenticated using (public.is_player());
drop policy if exists "players read reactions" on public.message_reactions;
create policy "players read reactions" on public.message_reactions
  for select to authenticated using (public.is_player());
-- No write policies: everything goes through the functions below.

create or replace function public.send_message(p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  body text := btrim(p_body);
  rec  public.messages;
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if body is null or char_length(body) = 0 then
    return json_build_object('ok', false, 'code', 'empty');
  end if;
  if char_length(body) > 1000 then
    return json_build_object('ok', false, 'code', 'too_long');
  end if;
  -- Light flood guard: at most 10 messages per 30 seconds.
  if (select count(*) from public.messages where user_id = uid and created_at > now() - interval '30 seconds') >= 10 then
    return json_build_object('ok', false, 'code', 'slow_down');
  end if;
  insert into public.messages (user_id, body) values (uid, body) returning * into rec;
  return json_build_object('ok', true, 'message', row_to_json(rec));
end $$;

-- Delete your own message (the admin can delete any). Leaves a "deleted" stub.
create or replace function public.delete_message(p_message uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  update public.messages set deleted = true, body = '·'
   where id = p_message and not deleted and (user_id = auth.uid() or public.is_admin());
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  delete from public.message_reactions where message_id = p_message;
  return json_build_object('ok', true);
end $$;

-- Add or remove one of your reactions on a message.
create or replace function public.toggle_reaction(p_message uuid, p_emoji text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if p_emoji not in ('👍', '🔥', '😂', '💀', '💪', '❤️') then
    return json_build_object('ok', false, 'code', 'bad_emoji');
  end if;
  if not exists (select 1 from public.messages where id = p_message and not deleted) then
    return json_build_object('ok', false, 'code', 'not_found');
  end if;
  delete from public.message_reactions where message_id = p_message and user_id = uid and emoji = p_emoji;
  if not found then
    insert into public.message_reactions (message_id, user_id, emoji) values (p_message, uid, p_emoji);
  end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.send_message(text) from public, anon;
revoke all on function public.delete_message(uuid) from public, anon;
revoke all on function public.toggle_reaction(uuid, text) from public, anon;
grant execute on function public.send_message(text) to authenticated;
grant execute on function public.delete_message(uuid) to authenticated;
grant execute on function public.toggle_reaction(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.message_reactions;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
