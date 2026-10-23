-- Add admin-authored, student-facing multiple choice tests.
-- Run in Supabase SQL Editor after the existing schema.sql.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  duration_minutes integer not null default 180 check (duration_minutes between 1 and 300)
);

-- Apply to existing installations as well as fresh setups.
alter table public.tests add column if not exists duration_minutes integer not null default 180 check (duration_minutes between 1 and 300);

create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 2000),
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
  ),
  image_path text,
  question_type text not null default 'single_correct',
  match_left jsonb,
  position integer not null check (position >= 0),
  unique (test_id, position)
);

alter table public.test_questions add column if not exists image_path text;
alter table public.test_questions add column if not exists question_type text not null default 'single_correct';
alter table public.test_questions add column if not exists match_left jsonb;
alter table public.test_questions drop constraint if exists test_questions_question_type_check;
alter table public.test_questions add constraint test_questions_question_type_check check (question_type in ('single_correct', 'multiple_correct', 'match_columns'));
alter table public.test_questions drop constraint if exists test_questions_match_left_check;
alter table public.test_questions add constraint test_questions_match_left_check check (
  case when question_type = 'match_columns' then
    case when jsonb_typeof(match_left) = 'array' then
      jsonb_array_length(match_left) between 2 and 6
      and jsonb_array_length(match_left) = jsonb_array_length(options)
    else false end
  else match_left is null end
);

-- Private question images: authenticated students can read signed images;
-- only admins can upload or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('test-question-images', 'test-question-images', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "authenticated users read test question images" on storage.objects;
create policy "authenticated users read test question images" on storage.objects for select to authenticated
  using (
    bucket_id = 'test-question-images'
    and (
      (select public.is_admin())
      or exists (
        select 1 from public.tests t
        where t.id::text = split_part(storage.objects.name, '/', 1) and t.published
      )
    )
  );
drop policy if exists "admins upload test question images" on storage.objects;
create policy "admins upload test question images" on storage.objects for insert to authenticated
  with check (bucket_id = 'test-question-images' and (select public.is_admin()));
drop policy if exists "admins update test question images" on storage.objects;
create policy "admins update test question images" on storage.objects for update to authenticated
  using (bucket_id = 'test-question-images' and (select public.is_admin()))
  with check (bucket_id = 'test-question-images' and (select public.is_admin()));
drop policy if exists "admins delete test question images" on storage.objects;
create policy "admins delete test question images" on storage.objects for delete to authenticated
  using (bucket_id = 'test-question-images' and (select public.is_admin()));

-- Answer keys are held in a separate table so students cannot fetch them.
create table if not exists public.test_answers (
  question_id uuid primary key references public.test_questions(id) on delete cascade,
  correct_option integer check (correct_option between 0 and 5),
  correct_answer jsonb
);

alter table public.test_answers add column if not exists correct_answer jsonb;
alter table public.test_answers alter column correct_option drop not null;
update public.test_answers set correct_answer = to_jsonb(correct_option) where correct_answer is null and correct_option is not null;
alter table public.test_answers alter column correct_answer set not null;

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  completed_at timestamptz not null default now()
);

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
create policy "published tests or admin read" on public.tests for select to authenticated
  using (published or (select public.is_admin()));
drop policy if exists "admins manage tests" on public.tests;
drop policy if exists "admins insert tests" on public.tests;
create policy "admins insert tests" on public.tests for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "admins update tests" on public.tests;
create policy "admins update tests" on public.tests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins delete tests" on public.tests;
create policy "admins delete tests" on public.tests for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "published questions or admin read" on public.test_questions;
create policy "published questions or admin read" on public.test_questions for select to authenticated
  using (exists (select 1 from public.tests t where t.id = test_id and (t.published or (select public.is_admin()))));
drop policy if exists "admins manage questions" on public.test_questions;
drop policy if exists "admins insert questions" on public.test_questions;
create policy "admins insert questions" on public.test_questions for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "admins update questions" on public.test_questions;
create policy "admins update questions" on public.test_questions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins delete questions" on public.test_questions;
create policy "admins delete questions" on public.test_questions for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "admins manage answer keys" on public.test_answers;
create policy "admins manage answer keys" on public.test_answers for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "users read own attempts or admin" on public.test_attempts;
create policy "users read own attempts or admin" on public.test_attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop function if exists public.submit_test(uuid, uuid[], integer[]);
drop function if exists public.submit_test(uuid, uuid[], jsonb);

create function public.submit_test(p_test_id uuid, p_question_ids uuid[], p_answers jsonb)
returns table(score integer, total integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_total integer;
  v_score integer := 0;
  v_index integer;
  v_question_id uuid;
  v_type text;
  v_options jsonb;
  v_match_left jsonb;
  v_correct jsonb;
  v_answer jsonb;
  v_entry record;
  v_numeric numeric;
  v_user_set integer[];
  v_correct_set integer[];
begin
  if v_user_id is null then
    raise exception 'Sign in to submit a test.' using errcode = '28000';
  end if;
  if p_question_ids is null or p_answers is null
     or jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Submit one response for every question.' using errcode = '22023';
  end if;
  if cardinality(p_question_ids) = 0
     or cardinality(p_question_ids) <> jsonb_array_length(p_answers) then
    raise exception 'Submit one response for every question.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tests t where t.id = p_test_id and t.published) then
    raise exception 'This test is unavailable.' using errcode = '22023';
  end if;

  select count(*) into v_total
  from public.test_questions q
  where q.test_id = p_test_id;
  if v_total = 0 or v_total <> cardinality(p_question_ids)
     or (select count(distinct submitted.question_id) from unnest(p_question_ids) as submitted(question_id)) <> v_total
     or (select count(*) from unnest(p_question_ids) as submitted(question_id)
         left join public.test_questions q on q.id = submitted.question_id and q.test_id = p_test_id
         where q.id is null) > 0 then
    raise exception 'Question list does not match this test.' using errcode = '22023';
  end if;
  if (select count(*) from public.test_answers a where a.question_id = any(p_question_ids)) <> v_total then
    raise exception 'Answer key is not configured for this test.' using errcode = '22023';
  end if;

  for v_index in 1..v_total loop
    v_question_id := p_question_ids[v_index];
    v_answer := p_answers -> (v_index - 1);
    select q.question_type, q.options, q.match_left, a.correct_answer
      into v_type, v_options, v_match_left, v_correct
      from public.test_questions q
      join public.test_answers a on a.question_id = q.id
      where q.id = v_question_id and q.test_id = p_test_id;

    if v_answer is null or v_answer = 'null'::jsonb then
      continue;
    end if;

    if v_type = 'single_correct' then
      if jsonb_typeof(v_answer) <> 'number' then
        raise exception 'A single-correct answer must be one option.' using errcode = '22023';
      end if;
      v_numeric := (v_answer #>> '{}')::numeric;
      if v_numeric <> trunc(v_numeric) or v_numeric < 0 or v_numeric >= jsonb_array_length(v_options) then
        raise exception 'A selected option is invalid.' using errcode = '22023';
      end if;
      if v_correct is null or jsonb_typeof(v_correct) is distinct from 'number' then
        raise exception 'The single-correct answer key is invalid.' using errcode = '22023';
      end if;
      v_numeric := (v_correct #>> '{}')::numeric;
      if v_numeric <> trunc(v_numeric) or v_numeric < 0 or v_numeric >= jsonb_array_length(v_options) then
        raise exception 'The single-correct answer key is invalid.' using errcode = '22023';
      end if;
      if v_answer = v_correct then v_score := v_score + 1; end if;

    elsif v_type = 'multiple_correct' then
      if jsonb_typeof(v_answer) is distinct from 'array' then
        raise exception 'Select at least one answer.' using errcode = '22023';
      end if;
      if jsonb_array_length(v_answer) = 0 then
        raise exception 'Select at least one answer.' using errcode = '22023';
      end if;
      for v_entry in select value from jsonb_array_elements(v_answer) loop
        if jsonb_typeof(v_entry.value) <> 'number' then
          raise exception 'A selected option is invalid.' using errcode = '22023';
        end if;
        v_numeric := (v_entry.value #>> '{}')::numeric;
        if v_numeric <> trunc(v_numeric) or v_numeric < 0 or v_numeric >= jsonb_array_length(v_options) then
          raise exception 'A selected option is invalid.' using errcode = '22023';
        end if;
      end loop;
      if (select count(*) from jsonb_array_elements(v_answer)) <> (select count(distinct value::text) from jsonb_array_elements(v_answer)) then
        raise exception 'A selected option is repeated.' using errcode = '22023';
      end if;
      if v_correct is null or jsonb_typeof(v_correct) is distinct from 'array' then
        raise exception 'The multiple-correct answer key is invalid.' using errcode = '22023';
      end if;
      if jsonb_array_length(v_correct) = 0 then
        raise exception 'The multiple-correct answer key is invalid.' using errcode = '22023';
      end if;
      select array_agg(value::integer order by value::integer) into v_user_set from jsonb_array_elements_text(v_answer);
      select array_agg(value::integer order by value::integer) into v_correct_set from jsonb_array_elements_text(v_correct);
      if v_user_set = v_correct_set then v_score := v_score + 1; end if;

    elsif v_type = 'match_columns' then
      if jsonb_typeof(v_answer) <> 'object' or jsonb_typeof(v_match_left) <> 'array'
         or jsonb_array_length(v_match_left) < 2
         or jsonb_array_length(v_match_left) <> jsonb_array_length(v_options) then
        raise exception 'The matching response is invalid.' using errcode = '22023';
      end if;
      for v_entry in select key, value from jsonb_each(v_answer) loop
        if v_entry.key !~ '^[0-9]+$' or jsonb_typeof(v_entry.value) <> 'number' then
          raise exception 'A column match is invalid.' using errcode = '22023';
        end if;
        if v_entry.key::integer >= jsonb_array_length(v_match_left) then
          raise exception 'A column match is invalid.' using errcode = '22023';
        end if;
        v_numeric := (v_entry.value #>> '{}')::numeric;
        if v_numeric <> trunc(v_numeric) or v_numeric < 0 or v_numeric >= jsonb_array_length(v_options) then
          raise exception 'A column match is invalid.' using errcode = '22023';
        end if;
      end loop;
      if (select count(*) from jsonb_each(v_answer)) <> (select count(distinct value::text) from jsonb_each(v_answer)) then
        raise exception 'Each Column II choice can be used only once.' using errcode = '22023';
      end if;
      if v_correct is null or jsonb_typeof(v_correct) <> 'object' then
        raise exception 'The matching answer key is invalid.' using errcode = '22023';
      end if;
      if v_answer = v_correct then v_score := v_score + 1; end if;
    else
      raise exception 'This question type is unsupported.' using errcode = '22023';
    end if;
  end loop;

  insert into public.test_attempts(test_id, user_id, score, total)
  values (p_test_id, v_user_id, v_score, v_total);
  return query select v_score, v_total;
end;
$$;

revoke all on function public.submit_test(uuid, uuid[], jsonb) from public, anon;
grant execute on function public.submit_test(uuid, uuid[], jsonb) to authenticated;

