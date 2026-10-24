-- Learning library for student-facing videos and notes.
-- Run once in Supabase SQL Editor after the existing app schema.
-- The storage bucket is private; students receive short-lived signed URLs only
-- for media attached to published library entries.

create table if not exists public.learning_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  subject text not null check (subject in ('Physics', 'Chemistry', 'Mathematics', 'Biology')),
  class_level text not null check (class_level in ('11', '12')),
  youtube_url text,
  file_path text,
  published boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint learning_videos_one_source check (
    (youtube_url is not null and file_path is null)
    or (youtube_url is null and file_path is not null)
  )
);

create table if not exists public.learning_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 1000),
  content text not null default '' check (char_length(content) <= 50000),
  subject text not null check (subject in ('Physics', 'Chemistry', 'Mathematics', 'Biology')),
  class_level text not null check (class_level in ('11', '12')),
  attachment_path text,
  attachment_type text check (
    attachment_type is null
    or attachment_type in ('image/jpeg', 'video/mp4', 'application/pdf')
  ),
  published boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint learning_notes_have_content check (
    char_length(btrim(content)) > 0 or attachment_path is not null
  ),
  constraint learning_notes_attachment_pair check (
    (attachment_path is null and attachment_type is null)
    or (attachment_path is not null and attachment_type is not null)
  )
);

create index if not exists learning_videos_class_subject_idx
  on public.learning_videos(class_level, subject, created_at desc);
create index if not exists learning_notes_class_subject_idx
  on public.learning_notes(class_level, subject, created_at desc);

alter table public.learning_videos enable row level security;
alter table public.learning_notes enable row level security;

revoke all on table public.learning_videos from anon, authenticated;
revoke all on table public.learning_notes from anon, authenticated;
grant select, insert, update, delete on table public.learning_videos to authenticated;
grant select, insert, update, delete on table public.learning_notes to authenticated;

drop policy if exists "students read published videos" on public.learning_videos;
create policy "students read published videos" on public.learning_videos
  for select to authenticated
  using (published or (select public.is_admin()));

drop policy if exists "admins insert videos" on public.learning_videos;
create policy "admins insert videos" on public.learning_videos
  for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));

drop policy if exists "admins update videos" on public.learning_videos;
create policy "admins update videos" on public.learning_videos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins delete videos" on public.learning_videos;
create policy "admins delete videos" on public.learning_videos
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "students read published notes" on public.learning_notes;
create policy "students read published notes" on public.learning_notes
  for select to authenticated
  using (published or (select public.is_admin()));

drop policy if exists "admins insert notes" on public.learning_notes;
create policy "admins insert notes" on public.learning_notes
  for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));

drop policy if exists "admins update notes" on public.learning_notes;
create policy "admins update notes" on public.learning_notes
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins delete notes" on public.learning_notes;
create policy "admins delete notes" on public.learning_notes
  for delete to authenticated
  using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-content',
  'learning-content',
  false,
  209715200,
  array['image/jpeg', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/ogg', 'video/3gpp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 209715200,
  allowed_mime_types = array['image/jpeg', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/ogg', 'video/3gpp', 'application/pdf'];

drop policy if exists "students read published learning media" on storage.objects;
create policy "students read published learning media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'learning-content'
    and (
      (select public.is_admin())
      or exists (
        select 1 from public.learning_videos v
        where v.file_path = storage.objects.name and v.published
      )
      or exists (
        select 1 from public.learning_notes n
        where n.attachment_path = storage.objects.name and n.published
      )
    )
  );

drop policy if exists "admins upload learning media" on storage.objects;
create policy "admins upload learning media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learning-content'
    and (select public.is_admin())
  );

drop policy if exists "admins update learning media" on storage.objects;
create policy "admins update learning media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'learning-content'
    and (select public.is_admin())
  )
  with check (
    bucket_id = 'learning-content'
    and (select public.is_admin())
  );

drop policy if exists "admins delete learning media" on storage.objects;
create policy "admins delete learning media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'learning-content'
    and (select public.is_admin())
  );
