-- Run once in Supabase SQL Editor after schema.sql to enable practice tests.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;
create table if not exists public.tests (id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id) on delete restrict, title text not null check (char_length(title) between 1 and 160), description text not null default '' check (char_length(description) <= 2000), published boolean not null default false, created_at timestamptz not null default now());
create table if not exists public.test_questions (id uuid primary key default gen_random_uuid(), test_id uuid not null references public.tests(id) on delete cascade, prompt text not null check (char_length(prompt) between 1 and 2000), options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6), position integer not null check (position >= 0), unique (test_id, position));
create table if not exists public.test_answers (question_id uuid primary key references public.test_questions(id) on delete cascade, correct_option integer not null check (correct_option between 0 and 5));
create table if not exists public.test_attempts (id uuid primary key default gen_random_uuid(), test_id uuid not null references public.tests(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, score integer not null check (score >= 0), total integer not null check (total > 0 and score <= total), completed_at timestamptz not null default now());
create index if not exists tests_published_created_idx on public.tests(published, created_at desc);
create index if not exists test_questions_test_position_idx on public.test_questions(test_id, position);
create index if not exists test_attempts_user_completed_idx on public.test_attempts(user_id, completed_at desc);
alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_answers enable row level security;
alter table public.test_attempts enable row level security;
revoke all on public.tests, public.test_questions, public.test_answers, public.test_attempts from anon, authenticated;
grant select, insert, update, delete on public.tests, public.test_questions, public.test_answers to authenticated;
grant select on public.test_attempts to authenticated;
drop policy if exists "published tests or admin read" on public.tests;
create policy "published tests or admin read" on public.tests for select to authenticated using (published or (select public.is_admin()));
drop policy if exists "admins manage tests" on public.tests;
create policy "admins manage tests" on public.tests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "published questions or admin read" on public.test_questions;
create policy "published questions or admin read" on public.test_questions for select to authenticated using (exists (select 1 from public.tests t where t.id = test_id and (t.published or (select public.is_admin()))));
drop policy if exists "admins manage questions" on public.test_questions;
create policy "admins manage questions" on public.test_questions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins manage answer keys" on public.test_answers;
create policy "admins manage answer keys" on public.test_answers for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "users read own attempts or admin" on public.test_attempts;
create policy "users read own attempts or admin" on public.test_attempts for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create or replace function public.submit_test(p_test_id uuid, p_question_ids uuid[], p_answers integer[]) returns table(score integer, total integer) language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_total integer; v_score integer;
begin
  if v_user_id is null then raise exception 'Sign in to submit a test.' using errcode = '28000'; end if;
  if p_question_ids is null or p_answers is null or cardinality(p_question_ids) = 0 or cardinality(p_question_ids) <> cardinality(p_answers) then raise exception 'Submit one answer for every question.' using errcode = '22023'; end if;
  if not exists (select 1 from public.tests t where t.id = p_test_id and t.published) then raise exception 'This test is unavailable.' using errcode = '22023'; end if;
  select count(*) into v_total from public.test_questions q where q.test_id = p_test_id;
  if v_total = 0 or v_total <> cardinality(p_question_ids) or (select count(distinct submitted.question_id) from unnest(p_question_ids) as submitted(question_id)) <> v_total then raise exception 'Question list does not match this test.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_question_ids, p_answers) as submitted(question_id, answer) left join public.test_questions q on q.id = submitted.question_id and q.test_id = p_test_id where q.id is null or submitted.answer is null or submitted.answer < 0 or submitted.answer >= jsonb_array_length(q.options)) then raise exception 'One or more answers are invalid.' using errcode = '22023'; end if;
  if (select count(*) from public.test_answers a where a.question_id = any(p_question_ids)) <> v_total then raise exception 'Answer key is not configured for this test.' using errcode = '22023'; end if;
  select count(*) filter (where a.correct_option = submitted.answer)::integer into v_score from unnest(p_question_ids, p_answers) as submitted(question_id, answer) join public.test_answers a on a.question_id = submitted.question_id;
  insert into public.test_attempts(test_id, user_id, score, total) values (p_test_id, v_user_id, v_score, v_total);
  return query select v_score, v_total;
end;
$$;
revoke all on function public.submit_test(uuid, uuid[], integer[]) from public, anon;
grant execute on function public.submit_test(uuid, uuid[], integer[]) to authenticated;
