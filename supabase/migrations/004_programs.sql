-- ============================================================================
-- Programs: 75 Hard, 75 Soft, and shorter Hard/Soft runs. Already part of
-- schema.sql; run this file once if you set up the database before it existed.
-- Idempotent.
-- ============================================================================

-- One row per attempt. Each player runs their own; a Hard restart ends the
-- old row and starts a new one with attempt + 1.
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  strict      boolean not null default true,           -- Hard: a missed day means back to Day 1
  length_days int  not null check (length_days between 7 and 365),
  tasks       jsonb not null,                          -- [{"id","label","emoji"}], 1–10 items
  start_date  date not null,
  status      text not null default 'active' check (status in ('active', 'completed', 'failed', 'quit')),
  attempt     int  not null default 1,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index if not exists programs_user on public.programs (user_id, status);

-- Which tasks were ticked on each day of a run.
create table if not exists public.program_days (
  program_id uuid not null references public.programs (id) on delete cascade,
  day        date not null,
  done       text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (program_id, day)
);

alter table public.programs     enable row level security;
alter table public.program_days enable row level security;

drop policy if exists "players read programs" on public.programs;
create policy "players read programs" on public.programs
  for select to authenticated using (public.is_player());
drop policy if exists "players read program days" on public.program_days;
create policy "players read program days" on public.program_days
  for select to authenticated using (public.is_player());
-- No write policies: everything goes through the functions below.

-- Start a run for yourself (today or tomorrow, club timezone).
create or replace function public.start_program(p_name text, p_strict boolean, p_length int,
                                                p_tasks jsonb, p_start_tomorrow boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  tz    text;
  today date;
  prev  int;
  rec   public.programs;
begin
  if uid is null or not public.is_player() then
    return json_build_object('ok', false, 'code', 'not_authenticated');
  end if;
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) not between 1 and 10
     or exists (select 1 from jsonb_array_elements(p_tasks) t
                 where coalesce(t ->> 'id', '') = '' or char_length(coalesce(t ->> 'label', '')) not between 1 and 80) then
    return json_build_object('ok', false, 'code', 'bad_tasks');
  end if;
  if p_length is null or p_length not between 7 and 365 then
    return json_build_object('ok', false, 'code', 'bad_length');
  end if;
  if (select count(*) from public.programs where user_id = uid and status = 'active') >= 3 then
    return json_build_object('ok', false, 'code', 'too_many');
  end if;
  select timezone into tz from public.settings where id = 1;
  today := (now() at time zone tz)::date;
  -- Attempt number counts previous runs of the same program name.
  select count(*) into prev from public.programs where user_id = uid and lower(name) = lower(trim(p_name));
  insert into public.programs (user_id, name, strict, length_days, tasks, start_date, attempt)
  values (uid, trim(p_name), p_strict, p_length, p_tasks,
          today + case when p_start_tomorrow then 1 else 0 end, prev + 1)
  returning * into rec;
  return json_build_object('ok', true, 'program', row_to_json(rec));
end $$;

-- Tick or untick one task. Only your own run, only today or yesterday
-- (yesterday stays open until it ends so a late tick still counts).
create or replace function public.toggle_program_task(p_program uuid, p_day date, p_task text, p_done boolean)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  tz    text;
  today date;
  p     public.programs;
begin
  select * into p from public.programs where id = p_program and user_id = uid and status = 'active';
  if p.id is null then return json_build_object('ok', false, 'code', 'not_found'); end if;
  select timezone into tz from public.settings where id = 1;
  today := (now() at time zone tz)::date;
  if p_day > today or p_day < today - 1 then
    return json_build_object('ok', false, 'code', 'locked');
  end if;
  if p_day < p.start_date or p_day > p.start_date + p.length_days - 1 then
    return json_build_object('ok', false, 'code', 'out_of_range');
  end if;
  if not exists (select 1 from jsonb_array_elements(p.tasks) t where t ->> 'id' = p_task) then
    return json_build_object('ok', false, 'code', 'bad_task');
  end if;

  insert into public.program_days (program_id, day, done)
  values (p.id, p_day, case when p_done then array[p_task] else '{}' end)
  on conflict (program_id, day) do update
    set done = case when p_done
                    then (select array_agg(distinct x) from unnest(public.program_days.done || p_task) x)
                    else array_remove(public.program_days.done, p_task) end,
        updated_at = now();
  return json_build_object('ok', true);
end $$;

-- Finish, give up, or record a failed run (before restarting).
create or replace function public.end_program(p_program uuid, p_status text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('completed', 'failed', 'quit') then
    return json_build_object('ok', false, 'code', 'bad_status');
  end if;
  update public.programs set status = p_status, ended_at = now()
   where id = p_program and user_id = auth.uid() and status = 'active';
  if not found then return json_build_object('ok', false, 'code', 'not_found'); end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.start_program(text, boolean, int, jsonb, boolean) from public, anon;
revoke all on function public.toggle_program_task(uuid, date, text, boolean) from public, anon;
revoke all on function public.end_program(uuid, text) from public, anon;
grant execute on function public.start_program(text, boolean, int, jsonb, boolean) to authenticated;
grant execute on function public.toggle_program_task(uuid, date, text, boolean) to authenticated;
grant execute on function public.end_program(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.programs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.program_days;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
