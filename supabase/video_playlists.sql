-- Add syllabus chapter playlists to the existing learning video library.
-- Safe to run after learning_content.sql; existing videos are preserved as Uncategorized.
alter table public.learning_videos
  add column if not exists chapter text,
  add column if not exists playlist_order integer;

update public.learning_videos
set chapter = 'Uncategorized'
where chapter is null;

with numbered as (
  select
    id,
    row_number() over (
      partition by class_level, subject, chapter
      order by created_at asc, id asc
    )::integer as position
  from public.learning_videos
)
update public.learning_videos as videos
set playlist_order = numbered.position
from numbered
where videos.id = numbered.id
  and videos.playlist_order is null;

alter table public.learning_videos
  alter column chapter set default 'Uncategorized',
  alter column chapter set not null,
  alter column playlist_order set default 1,
  alter column playlist_order set not null;

create index if not exists learning_videos_playlist_idx
  on public.learning_videos(class_level, subject, chapter, playlist_order, created_at);
