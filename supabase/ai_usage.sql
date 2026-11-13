-- Ask AI daily limit (server-side, per student per day, India time).
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- Until it is run, Ask AI still works and falls back to a signed-cookie
-- soft limit. Students cannot read or change this table directly; only
-- the two functions below touch it, and only for the signed-in student.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- No policies on purpose: direct reads/writes from the browser are blocked.

-- Takes one question from today's allowance.
-- Returns the new count for today, or -1 if the limit was already reached.
create or replace function public.ai_usage_take(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  insert into public.ai_usage(user_id, day, count) values (v_user, v_day, 0)
    on conflict (user_id, day) do nothing;
  update public.ai_usage set count = count + 1
    where user_id = v_user and day = v_day and count < p_limit
    returning count into v_count;
  return coalesce(v_count, -1);
end;
$$;

-- Gives one question back (used when the AI call itself failed).
create or replace function public.ai_usage_refund()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_usage set count = greatest(count - 1, 0)
    where user_id = auth.uid() and day = (now() at time zone 'Asia/Kolkata')::date;
end;
$$;

-- Today's count for the signed-in student (0 if none yet).
create or replace function public.ai_usage_today()
returns integer
language sql
security definer
set search_path = ''
as $$
  select coalesce((select count from public.ai_usage
    where user_id = auth.uid() and day = (now() at time zone 'Asia/Kolkata')::date), 0);
$$;

revoke all on function public.ai_usage_take(integer) from public, anon;
revoke all on function public.ai_usage_refund() from public, anon;
revoke all on function public.ai_usage_today() from public, anon;
grant execute on function public.ai_usage_take(integer) to authenticated;
grant execute on function public.ai_usage_refund() to authenticated;
grant execute on function public.ai_usage_today() to authenticated;
