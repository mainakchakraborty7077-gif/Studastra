-- =====================================================================
-- StudAstra — Auth overhaul: roles, mobile login, parents, teachers,
-- courses, attendance, audit log and row level security.
--
-- Run in Supabase SQL Editor AFTER supabase/schema.sql (and after tests.sql /
-- learning_content.sql if you use them). Idempotent: safe to rerun.
--
-- It ALTERS the existing public.profiles table instead of recreating it, so
-- existing users, notes, tests and progress are kept.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. profiles: extend the existing table
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists mobile_number text;
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
-- Columns already used by the student profile page (added if missing).
alter table public.profiles add column if not exists grade text;
alter table public.profiles add column if not exists target_exam text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists blood_group text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists phone text;

-- Replace the old role check ('student','admin') with the four roles.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student','parent','teacher','admin'));

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active','inactive','suspended'));

-- Mobile numbers are stored in E.164 form, e.g. +919876543210.
alter table public.profiles drop constraint if exists profiles_mobile_number_format;
alter table public.profiles add constraint profiles_mobile_number_format
  check (mobile_number is null or mobile_number ~ '^\+[1-9][0-9]{7,14}$');
create unique index if not exists profiles_mobile_number_key on public.profiles(mobile_number);
create index if not exists profiles_role_status_idx on public.profiles(role, account_status);

-- Backfill full_name from the legacy display_name.
update public.profiles set full_name = display_name
where (full_name is null or full_name = '') and coalesce(display_name, '') <> '';

-- New auth users always start as a student profile. Roles are NEVER read from
-- user-editable metadata; admin routes set the real role with the service key.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, full_name, mobile_number, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', ''), ''),
    case when coalesce(new.phone, '') <> '' then '+' || ltrim(new.phone, '+') end,
    'student',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER avoids recursive RLS lookups)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.account_status = 'active';
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.account_status = 'active'
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Role tables
-- ---------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key references public.profiles(id) on delete cascade,
  student_code text not null,
  class_name text,
  batch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists students_student_code_key on public.students(upper(student_code));

create table if not exists public.parents (
  id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_student (
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text not null default 'guardian'
    check (relationship in ('father','mother','guardian','other')),
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);
create index if not exists parent_student_student_idx on public.parent_student(student_id);

create table if not exists public.teachers (
  id uuid primary key references public.profiles(id) on delete cascade,
  employee_code text,
  subjects text,
  created_at timestamptz not null default now()
);
create unique index if not exists teachers_employee_code_key on public.teachers(upper(employee_code)) where employee_code is not null;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists courses_code_key on public.courses(upper(code));

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','dropped')),
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);
create index if not exists enrollments_course_idx on public.enrollments(course_id);

-- Permissions that admins grant to teachers.
create table if not exists public.admin_permissions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null check (permission in (
    'manage_students','manage_parents','manage_content','view_progress','manage_attendance','view_audit'
  )),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, permission)
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  session_label text not null default 'General',
  status text not null check (status in ('present','absent','late','excused')),
  remarks text,
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date, session_label)
);
create index if not exists attendance_date_idx on public.attendance(attendance_date desc);

-- Helpers that depend on the tables above.
create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.admin_permissions ap
    join public.profiles p on p.id = ap.profile_id
    where ap.profile_id = (select auth.uid())
      and ap.permission = p_permission
      and p.role = 'teacher'
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_parent_of(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.parent_student ps
    join public.profiles p on p.id = ps.parent_id
    where ps.parent_id = (select auth.uid())
      and ps.student_id = p_student
      and p.role = 'parent'
      and p.account_status = 'active'
  );
$$;

-- Used by the login API (service role) to check a number before sending an OTP.
create or replace function public.lookup_login_account(p_mobile text)
returns table (id uuid, role text, account_status text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.role, p.account_status from public.profiles p where p.mobile_number = p_mobile;
$$;
revoke all on function public.lookup_login_account(text) from public, anon, authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_parent_of(uuid) to authenticated;

-- Students and parents may edit their own profile details, but never their
-- role, status or login mobile. Server routes (no auth.uid()) and admins may.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  if new.role is distinct from old.role
     or new.account_status is distinct from old.account_status
     or new.mobile_number is distinct from old.mobile_number then
    raise exception 'Only an administrator can change role, account status or login mobile.'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute procedure public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------
-- 4. Privileges
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.parent_student enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.attendance enable row level security;

revoke all on public.students, public.parents, public.parent_student, public.teachers,
  public.courses, public.enrollments, public.admin_permissions, public.audit_logs,
  public.attendance from anon, authenticated;
grant select on public.students, public.parents, public.parent_student, public.teachers,
  public.courses, public.enrollments, public.admin_permissions, public.audit_logs
  to authenticated;
grant insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
-- Account creation and linking happen only in server routes with the service role key.

-- ---------------------------------------------------------------------
-- 5. Row level security policies
-- ---------------------------------------------------------------------
-- profiles
drop policy if exists "profile read own or admin" on public.profiles;
drop policy if exists "profiles read scoped" on public.profiles;
create policy "profiles read scoped" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
    or (role = 'student' and (select public.is_parent_of(id)))
    or (role = 'student' and ((select public.has_permission('manage_students'))
                               or (select public.has_permission('view_progress'))
                               or (select public.has_permission('manage_attendance'))))
    or (role = 'parent' and (select public.has_permission('manage_parents')))
  );

drop policy if exists "profile update own non-role" on public.profiles;
create policy "profile update own non-role" on public.profiles for update to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()))
  with check ((select auth.uid()) = id or (select public.is_admin()));
-- (role/status/mobile changes are blocked by the profiles_guard_privileged trigger)

-- students
drop policy if exists "students read scoped" on public.students;
create policy "students read scoped" on public.students for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_parent_of(id))
    or (select public.has_permission('manage_students'))
    or (select public.has_permission('view_progress'))
    or (select public.has_permission('manage_attendance'))
  );

-- parents
drop policy if exists "parents read scoped" on public.parents;
create policy "parents read scoped" on public.parents for select to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('manage_parents')));

-- parent_student
drop policy if exists "parent links read scoped" on public.parent_student;
create policy "parent links read scoped" on public.parent_student for select to authenticated
  using (
    parent_id = (select auth.uid())
    or student_id = (select auth.uid())
    or (select public.has_permission('manage_parents'))
  );

-- teachers
drop policy if exists "teachers read scoped" on public.teachers;
create policy "teachers read scoped" on public.teachers for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- courses: every signed-in user can read active courses; admins manage them.
drop policy if exists "courses read" on public.courses;
create policy "courses read" on public.courses for select to authenticated
  using (is_active or (select public.is_admin()));
drop policy if exists "courses admin write" on public.courses;
create policy "courses admin write" on public.courses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- enrollments
drop policy if exists "enrollments read scoped" on public.enrollments;
create policy "enrollments read scoped" on public.enrollments for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.is_parent_of(student_id))
    or (select public.has_permission('manage_students'))
    or (select public.has_permission('view_progress'))
  );

-- admin_permissions
drop policy if exists "permissions read own or admin" on public.admin_permissions;
create policy "permissions read own or admin" on public.admin_permissions for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));

-- audit_logs: read-only for admins (and teachers granted view_audit); writes via service role only.
drop policy if exists "audit read admins" on public.audit_logs;
create policy "audit read admins" on public.audit_logs for select to authenticated
  using ((select public.has_permission('view_audit')));

-- attendance
drop policy if exists "attendance read scoped" on public.attendance;
create policy "attendance read scoped" on public.attendance for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.is_parent_of(student_id))
    or (select public.has_permission('manage_attendance'))
    or (select public.has_permission('view_progress'))
  );
drop policy if exists "attendance staff insert" on public.attendance;
create policy "attendance staff insert" on public.attendance for insert to authenticated
  with check ((select public.has_permission('manage_attendance')));
drop policy if exists "attendance staff update" on public.attendance;
create policy "attendance staff update" on public.attendance for update to authenticated
  using ((select public.has_permission('manage_attendance')))
  with check ((select public.has_permission('manage_attendance')));
drop policy if exists "attendance staff delete" on public.attendance;
create policy "attendance staff delete" on public.attendance for delete to authenticated
  using ((select public.has_permission('manage_attendance')));

-- ---------------------------------------------------------------------
-- 6. Extra read access on existing tables (only if those tables exist):
--    parents see linked students' results and progress; teachers see what
--    their permissions allow; teachers with manage_content edit content.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  -- Student activity tables keyed by user_id.
  foreach t in array array['test_attempts','chapter_progress','study_sessions','study_items'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "parents and staff read %s" on public.%I', t, t);
      execute format(
        'create policy "parents and staff read %s" on public.%I for select to authenticated
           using ((select public.is_parent_of(user_id)) or (select public.has_permission(''view_progress'')))',
        t, t);
    end if;
  end loop;

  -- Content tables: teachers with manage_content get full access.
  foreach t in array array['tests','test_questions','test_answers','learning_videos','learning_notes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "content staff manage %s" on public.%I', t, t);
      execute format(
        'create policy "content staff manage %s" on public.%I for all to authenticated
           using ((select public.has_permission(''manage_content'')))
           with check ((select public.has_permission(''manage_content'')))',
        t, t);
    end if;
  end loop;
end $$;

-- Storage: teachers with manage_content can manage files in the content buckets.
drop policy if exists "content staff manage storage" on storage.objects;
create policy "content staff manage storage" on storage.objects for all to authenticated
  using (bucket_id in ('learning-content','test-question-images') and (select public.has_permission('manage_content')))
  with check (bucket_id in ('learning-content','test-question-images') and (select public.has_permission('manage_content')));

-- ---------------------------------------------------------------------
-- 7. Backfill: every existing student profile gets a students row so the
--    rest of the app (attendance, parents) can reference it.
-- ---------------------------------------------------------------------
insert into public.students (id, student_code, class_name)
select p.id, 'SA-' || upper(substr(replace(p.id::text, '-', ''), 1, 8)), p.grade
from public.profiles p
where p.role = 'student'
  and not exists (select 1 from public.students s where s.id = p.id)
on conflict do nothing;

-- =====================================================================
-- BOOTSTRAP THE FIRST ADMIN (run once, by hand, after the script above)
-- ---------------------------------------------------------------------
-- 1. Supabase Dashboard → Authentication → Users → "Add user" →
--    "Create new user": enter the admin's phone (+91XXXXXXXXXX), a strong
--    password, and tick "Auto confirm user". (Email is optional.)
-- 2. Run the statement below with the same number:
--
--    update public.profiles
--    set role = 'admin',
--        account_status = 'active',
--        full_name = 'Your Name',
--        mobile_number = '+91XXXXXXXXXX'
--    where id = (select id from auth.users where phone = '91XXXXXXXXXX');
--    delete from public.students
--    where id = (select id from auth.users where phone = '91XXXXXXXXXX');
--
--    (auth.users.phone is stored WITHOUT the leading "+".)
-- 3. Open /admin/login, sign in with mobile + password, then scan the QR
--    code with an authenticator app to enrol TOTP. MFA is mandatory.
--
-- An existing email-based admin keeps working: just add a mobile number
-- with the same UPDATE (role already 'admin'), or sign in with email at
-- /admin/login.
-- =====================================================================
