-- Licensed JEE Previous Year Question catalog for the student PYQ Zone.
-- Run after schema.sql and tests.sql in the Supabase SQL editor.

create table if not exists public.pyq_questions (
  id uuid primary key default gen_random_uuid(),
  exam text not null check (exam in ('JEE Main', 'JEE Advanced')),
  year integer not null check (year between 1980 and 2100),
  subject text not null check (subject in ('Physics', 'Chemistry', 'Mathematics')),
  topic text,
  paper text,
  prompt text not null check (char_length(prompt) between 1 and 10000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  question_type text not null default 'single_correct' check (question_type in ('single_correct', 'multiple_correct', 'integer', 'numerical')),
  source_name text not null default 'JEE question archive',
  source_url text,
  image_url text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pyq_answers (
  question_id uuid primary key references public.pyq_questions(id) on delete cascade,
  correct_answer jsonb not null,
  explanation text not null default '' check (char_length(explanation) <= 12000)
);

create index if not exists pyq_questions_catalog_idx
  on public.pyq_questions (exam, subject, year desc) where published;
create index if not exists pyq_questions_topic_idx
  on public.pyq_questions using gin (to_tsvector('english', coalesce(topic, '') || ' ' || prompt));

alter table public.pyq_questions enable row level security;
alter table public.pyq_answers enable row level security;
revoke all on public.pyq_questions, public.pyq_answers from anon, authenticated;
grant select on public.pyq_questions to authenticated;
grant insert, update, delete on public.pyq_questions, public.pyq_answers to authenticated;

drop policy if exists "students read published PYQs, admins read all" on public.pyq_questions;
create policy "students read published PYQs, admins read all" on public.pyq_questions
  for select to authenticated using (
    published or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

drop policy if exists "admins manage PYQ questions" on public.pyq_questions;
create policy "admins manage PYQ questions" on public.pyq_questions
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "admins manage PYQ answers" on public.pyq_answers;
create policy "admins manage PYQ answers" on public.pyq_answers
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create or replace function public.get_pyq_answer(p_question_id uuid)
returns table(correct_answer jsonb, explanation text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.correct_answer, a.explanation
  from public.pyq_answers a
  join public.pyq_questions q on q.id = a.question_id
  where q.id = p_question_id and q.published and auth.uid() is not null;
$$;
revoke all on function public.get_pyq_answer(uuid) from public, anon;
grant execute on function public.get_pyq_answer(uuid) to authenticated;
