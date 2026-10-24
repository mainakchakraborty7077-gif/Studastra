"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getYouTubeEmbedUrl,
  LEARNING_CONTENT_BUCKET,
  type ContentClass,
  type ContentSubject,
  type LearningVideo,
} from "@/lib/learning-content";

type VideoWithUrl = LearningVideo & { signedUrl: string | null };
type SubjectFilter = ContentSubject | "all";
type ClassFilter = ContentClass | "all";
type Playlist = {
  key: string;
  classLevel: ContentClass;
  subject: ContentSubject;
  chapter: string;
  videos: VideoWithUrl[];
};

const SUBJECTS: ContentSubject[] = ["Physics", "Chemistry", "Mathematics", "Biology"];
const VIDEO_SELECT =
  "id,title,description,subject,class_level,chapter,playlist_order,youtube_url,file_path,published,created_at";

export default function StudentVideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>("all");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVideos() {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("learning_videos")
        .select(VIDEO_SELECT)
        .eq("published", true)
        .order("class_level", { ascending: true })
        .order("subject", { ascending: true })
        .order("chapter", { ascending: true })
        .order("playlist_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const items = await Promise.all(
        ((data ?? []) as LearningVideo[]).map(async (video) => {
          if (!video.file_path) return { ...video, signedUrl: null };
          const { data: signed, error: signedError } = await supabase.storage
            .from(LEARNING_CONTENT_BUCKET)
            .createSignedUrl(video.file_path, 60 * 60);
          if (signedError) throw signedError;
          return { ...video, signedUrl: signed.signedUrl };
        }),
      );

      if (cancelled) return;
      setVideos(items);
      setActiveVideoId(items[0]?.id ?? null);
      setLoading(false);
    }

    void loadVideos().catch((error) => {
      if (cancelled) return;
      setMessage(error instanceof Error ? error.message : "Could not load videos. Please try again.");
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [router]);

  const filteredVideos = useMemo(
    () =>
      videos.filter(
        (video) =>
          (subjectFilter === "all" || video.subject === subjectFilter) &&
          (classFilter === "all" || video.class_level === classFilter) &&
          (chapterFilter === "all" || video.chapter === chapterFilter),
      ),
    [videos, subjectFilter, classFilter, chapterFilter],
  );

  useEffect(() => {
    if (!filteredVideos.some((video) => video.id === activeVideoId)) {
      setActiveVideoId(filteredVideos[0]?.id ?? null);
    }
  }, [filteredVideos, activeVideoId]);

  const chapters = useMemo(
    () =>
      Array.from(
        new Set(
          videos
            .filter(
              (video) =>
                (subjectFilter === "all" || video.subject === subjectFilter) &&
                (classFilter === "all" || video.class_level === classFilter),
            )
            .map((video) => video.chapter),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [videos, subjectFilter, classFilter],
  );

  const playlists = useMemo(() => {
    const groups = new Map<string, Playlist>();
    for (const video of filteredVideos) {
      const key = [video.class_level, video.subject, video.chapter].join("|");
      const existing = groups.get(key);
      if (existing) existing.videos.push(video);
      else groups.set(key, {
        key,
        classLevel: video.class_level,
        subject: video.subject,
        chapter: video.chapter,
        videos: [video],
      });
    }
    return Array.from(groups.values());
  }, [filteredVideos]);

  return (
    <main className="vl-page">
      <style>{styles}</style>
      <div className="vl-wrap">
        <Link href="/dashboard" className="vl-back">← Back to dashboard</Link>
        <header>
          <p className="vl-kicker">STUDY LIBRARY</p>
          <h1>Educational video playlists</h1>
          <p className="vl-sub">Browse by subject or syllabus chapter. Every chapter playlist is numbered in viewing order.</p>
        </header>

        <section className="vl-filters" aria-label="Filter video playlists">
          <label>Subject
            <select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value as SubjectFilter); setChapterFilter("all"); }}>
              <option value="all">All subjects</option>
              {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </label>
          <label>Class
            <select value={classFilter} onChange={(event) => { setClassFilter(event.target.value as ClassFilter); setChapterFilter("all"); }}>
              <option value="all">All classes</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>
          </label>
          <label>Chapter
            <select value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)}>
              <option value="all">All chapters</option>
              {chapters.map((chapter) => <option key={chapter} value={chapter}>{chapter}</option>)}
            </select>
          </label>
        </section>

        {loading && <p role="status">Loading videos...</p>}
        {message && <p className="vl-message" role="status">{message}</p>}
        {!loading && !message && filteredVideos.length === 0 && <section className="vl-card">No videos match these filters yet.</section>}

        <div className="vl-playlists">
          {playlists.map((playlist) => {
            const selected = playlist.videos.find((video) => video.id === activeVideoId) ?? null;
            const selectedIndex = selected ? playlist.videos.findIndex((video) => video.id === selected.id) : -1;
            const embedUrl = selected?.youtube_url ? getYouTubeEmbedUrl(selected.youtube_url) : null;

            return (
              <section className="vl-playlist" key={playlist.key}>
                <header className="vl-playlist-head">
                  <p className="vl-meta">CLASS {playlist.classLevel} · {playlist.subject.toUpperCase()}</p>
                  <h2>{playlist.chapter}</h2>
                  <p className="vl-sub">{playlist.videos.length} video{playlist.videos.length === 1 ? "" : "s"} in this chapter playlist</p>
                </header>

                {selected && (
                  <div className="vl-player">
                    {embedUrl ? (
                      <iframe src={embedUrl} title={selected.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                    ) : selected.signedUrl ? (
                      <video controls preload="metadata" src={selected.signedUrl}>Your browser does not support HTML video.</video>
                    ) : (
                      <div className="vl-placeholder">Video unavailable</div>
                    )}
                    <p className="vl-meta">VIDEO {selected.playlist_order} OF {playlist.videos.length}</p>
                    <h3>{selected.title}</h3>
                    {selected.description && <p className="vl-sub">{selected.description}</p>}
                    <div className="vl-player-actions">
                      <button type="button" disabled={selectedIndex <= 0} onClick={() => setActiveVideoId(playlist.videos[selectedIndex - 1]?.id ?? null)}>← Previous</button>
                      <button type="button" disabled={selectedIndex < 0 || selectedIndex >= playlist.videos.length - 1} onClick={() => setActiveVideoId(playlist.videos[selectedIndex + 1]?.id ?? null)}>Next →</button>
                    </div>
                  </div>
                )}

                <ol className="vl-list">
                  {playlist.videos.map((video) => (
                    <li key={video.id}>
                      <button className={video.id === activeVideoId ? "vl-item is-active" : "vl-item"} type="button" aria-pressed={video.id === activeVideoId} onClick={() => setActiveVideoId(video.id)}>
                        <span className="vl-number">{video.playlist_order}</span>
                        <span className="vl-item-copy"><strong>{video.title}</strong>{video.description && <small>{video.description}</small>}</span>
                        <span className="vl-play-mark">{video.id === activeVideoId ? "Playing" : "Play"}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

const styles = `
.vl-page{min-height:100vh;padding:28px 18px 64px;background:radial-gradient(ellipse at 70% 0%,#0f2530 0%,#0a1016 55%);color:#e8f1f5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.vl-wrap{max-width:1120px;margin:0 auto}
.vl-back{color:rgba(232,241,245,.7);text-decoration:none}
.vl-back:hover{color:#7fe7f2}
.vl-wrap>header{margin:30px 0}
.vl-kicker{font-size:12px;letter-spacing:.14em;color:#7fe7f2}
.vl-wrap h1{margin:8px 0;font-size:34px}
.vl-sub{color:rgba(232,241,245,.65);line-height:1.6}
.vl-filters{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}
.vl-filters label{display:grid;gap:6px;min-width:190px;color:rgba(232,241,245,.75);font-size:13px}
.vl-filters select{padding:11px 13px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:#121c25;color:#e8f1f5}
.vl-playlists{display:grid;gap:18px}
.vl-playlist{overflow:hidden;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(18,28,37,.88)}
.vl-playlist-head{padding:20px 20px 10px}
.vl-playlist-head h2{font-size:22px;margin:7px 0}
.vl-playlist-head p{margin:5px 0}
.vl-player{padding:0 20px 18px}
.vl-player iframe,.vl-player video{display:block;width:100%;max-height:600px;aspect-ratio:16/9;border:0;border-radius:12px;background:#05080b}
.vl-player h3{font-size:19px;margin:8px 0}
.vl-player p{margin:7px 0}
.vl-player-actions{display:flex;gap:8px;margin-top:12px}
.vl-player-actions button{padding:9px 13px;border:1px solid rgba(127,231,242,.35);border-radius:9px;background:#122b34;color:#dffbff}
.vl-player-actions button:disabled{opacity:.4}
.vl-list{list-style:none;margin:0;padding:0 12px 12px}
.vl-list li+li{border-top:1px solid rgba(255,255,255,.07)}
.vl-item{display:flex;align-items:center;gap:12px;width:100%;padding:13px 9px;border:0;text-align:left;background:transparent;color:#e8f1f5;cursor:pointer}
.vl-item:hover,.vl-item.is-active{background:rgba(127,231,242,.08)}
.vl-number{display:grid;place-items:center;flex:0 0 32px;height:32px;border-radius:50%;background:#18323b;color:#7fe7f2;font-size:13px}
.vl-item-copy{display:grid;gap:4px;flex:1;min-width:0}
.vl-item-copy small{color:rgba(232,241,245,.62);line-height:1.4}
.vl-play-mark{font-size:12px;color:#7fe7f2}
.vl-meta{font-size:12px;color:#7fe7f2}
.vl-message{padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:12px}
.vl-placeholder{aspect-ratio:16/9;display:grid;place-items:center;background:#05080b;border-radius:12px;color:rgba(232,241,245,.6)}
`;
