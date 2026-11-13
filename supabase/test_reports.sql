-- Test report card + leaderboard support.
-- Run this ONCE in the Supabase SQL Editor (after schema.sql and tests.sql).
-- Safe to re-run. Every attempt was already stored in public.test_attempts;
-- this adds per-attempt detail (attempted count, time taken) and a
-- privacy-safe leaderboard (display names only, never emails).

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists display_name text;
alter table public.test_attempts add column if not exists attempted integer;
alter table public.test_attempts add column if not exists time_taken_seconds integer;
alter table public.test_attempts drop constraint if exists test_attempts_attempted_check;
alter table public.test_attempts add constraint test_attempts_attempted_check
  check (attempted is null or (attempted >= score and attempted <= total));
alter table public.test_attempts drop constraint if exists test_attempts_time_check;
alter table public.test_attempts add constraint test_attempts_time_check
  check (time_taken_seconds is null or time_taken_seconds >= 0);
create index if not exists test_attempts_test_idx on public.test_attempts(test_id, score desc);

-- Re-create submit_test so it also records how many questions were answered
-- and how long the student took. Old 3-argument calls still work (default).
drop function if exists public.submit_test(uuid, uuid[], integer[]);
drop function if exists public.submit_test(uuid, uuid[], jsonb);
drop function if exists public.submit_test(uuid, uuid[], jsonb, integer);

create function public.submit_test(p_test_id uuid, p_question_ids uuid[], p_answers jsonb, p_time_taken_seconds integer default null)
returns table(score integer, total integer, attempted integer, attempt_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_total integer;
  v_score integer := 0;
  v_attempted integer := 0;
  v_attempt_id uuid;
  v_time integer;
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
    v_attempted := v_attempted + 1;

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

  v_time := case when p_time_taken_seconds is null or p_time_taken_seconds < 0 then null
                 else least(p_time_taken_seconds, 86400) end;
  insert into public.test_attempts(test_id, user_id, score, total, attempted, time_taken_seconds)
  values (p_test_id, v_user_id, v_score, v_total, v_attempted, v_time)
  returning id into v_attempt_id;
  return query select v_score, v_total, v_attempted, v_attempt_id;
end;
$$;

grant execute on function public.submit_test(uuid, uuid[], jsonb, integer) to authenticated;
revoke all on function public.submit_test(uuid, uuid[], jsonb, integer) from public, anon;

-- Leaderboard. Students cannot read other students' attempts or profiles
-- directly, so this security-definer function returns only display names,
-- scores and an "is_me" flag (no emails, no user ids).
-- p_test_id null  -> overall ranking (sum of each student's best score per test)
-- p_test_id given -> ranking for that test (each student's best attempt)
drop function if exists public.test_leaderboard(uuid, integer);
create function public.test_leaderboard(p_test_id uuid default null, p_limit integer default 20)
returns table(
  rank bigint,
  display_name text,
  tests_taken integer,
  attempts integer,
  score integer,
  total integer,
  percent numeric,
  best_time_seconds integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select a.* from public.test_attempts a
    join public.tests t on t.id = a.test_id and t.published
    where p_test_id is null or a.test_id = p_test_id
  ),
  best as (
    select distinct on (v.user_id, v.test_id)
      v.user_id, v.test_id, v.score, v.total, v.time_taken_seconds
    from visible v
    order by v.user_id, v.test_id, v.score desc, v.time_taken_seconds asc nulls last, v.completed_at asc
  ),
  counts as (
    select user_id, count(*)::integer as attempts from visible group by user_id
  ),
  per_user as (
    select b.user_id,
      count(*)::integer as tests_taken,
      sum(b.score)::integer as score,
      sum(b.total)::integer as total,
      round(100.0 * sum(b.score) / nullif(sum(b.total), 0), 1) as percent,
      sum(b.time_taken_seconds)::integer as best_time_seconds
    from best b group by b.user_id
  ),
  ranked as (
    select
      rank() over (order by p.score desc, p.percent desc, p.best_time_seconds asc nulls last) as rank,
      coalesce(
        nullif(btrim(pr.full_name), ''),
        nullif(btrim(pr.display_name), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
        'Student'
      ) as display_name,
      p.tests_taken, c.attempts, p.score, p.total, p.percent, p.best_time_seconds,
      p.user_id = (select auth.uid()) as is_me
    from per_user p
    join counts c on c.user_id = p.user_id
    left join public.profiles pr on pr.id = p.user_id
    left join auth.users u on u.id = p.user_id
  )
  select * from ranked
  where rank <= greatest(1, least(coalesce(p_limit, 20), 100)) or is_me
  order by rank, display_name;
$$;
revoke all on function public.test_leaderboard(uuid, integer) from public, anon;
grant execute on function public.test_leaderboard(uuid, integer) to authenticated;
