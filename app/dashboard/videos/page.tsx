"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getYouTubeEmbedUrl,
  LEARNING_CONTENT_BUCKET,
  type LearningVideo,
} from "@/lib/learning-content";
import { placeVideo } from "@/lib/learning-library";
import LibraryBrowser, { type LibraryItem } from "@/components/LibraryBrowser";

type VideoWithUrl = LearningVideo & { signedUrl: string | null; cleanDescription?: string };
const VIDEO_SELECT =
  "id,title,description,subject,class_level,chapter,playlist_order,youtube_url,file_path,published,created_at";

export default function StudentVideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [unlockedVideos, setUnlockedVideos] = useState<Record<string, boolean>>({});

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
      setLoading(false);
    }

    void loadVideos().catch((error) => {
      if (cancelled) return;
      setMessage(error instanceof Error ? error.message : "Could not load videos. Please try again.");
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [router]);

  const libraryItems = useMemo<LibraryItem<VideoWithUrl>[]>(
    () =>
      videos.map((video) => {
        const placement = placeVideo(video);
        return {
          item: { ...video, cleanDescription: placement.cleanDescription },
          subject: video.subject,
          classLevel: video.class_level,
          chapter: placement.chapter,
          language: placement.language,
        };
      }),
    [videos],
  );

  return (
    <main className="vl-page">
      <style>{styles}</style>
      <div className="vl-wrap">
        <Link href="/dashboard" className="vl-back">← Back to dashboard</Link>
        <header>
          <p className="vl-kicker">STUDY LIBRARY</p>
          <h1>Educational video playlists</h1>
          <p className="vl-sub">Classes organised chapter-wise. Open a chapter folder, then pick the English or Bangla version. Every playlist is numbered in viewing order.</p>
        </header>

        {loading && <p role="status">Loading videos...</p>}
        {message && <p className="vl-message" role="status">{message}</p>}
        {!loading && !message && videos.length === 0 && <section className="vl-card">No videos are published yet.</section>}

        {!loading && !message && videos.length > 0 && (
          <LibraryBrowser
            items={libraryItems}
            noun="videos"
            renderItems={(entries, folder) => (
              <VideoPlaylist
                key={folder.chapter + "|" + folder.language + "|" + entries.map((e) => e.item.id).join(",")}
                videos={entries.map((entry) => entry.item).sort((a, b) => (a.playlist_order ?? 0) - (b.playlist_order ?? 0) || a.created_at.localeCompare(b.created_at))}
                unlocked={unlockedVideos}
                onUnlock={(id) => setUnlockedVideos((prev) => ({ ...prev, [id]: true }))}
              />
            )}
          />
        )}
      </div>
    </main>
  );
}

function VideoPlaylist({
  videos,
  unlocked,
  onUnlock,
}: {
  videos: VideoWithUrl[];
  unlocked: Record<string, boolean>;
  onUnlock: (id: string) => void;
}) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(videos[0]?.id ?? null);
  const selected = videos.find((video) => video.id === activeVideoId) ?? videos[0] ?? null;
  const selectedIndex = selected ? videos.findIndex((video) => video.id === selected.id) : -1;
  const embedUrl = selected?.youtube_url ? getYouTubeEmbedUrl(selected.youtube_url) : null;

  return (
    <section className="vl-playlist">
      <header className="vl-playlist-head">
        <p className="vl-sub">{videos.length} video{videos.length === 1 ? "" : "s"} in this playlist</p>
      </header>

      {selected && (
        <div className="vl-player">
          {!unlocked[selected.id] ? (
            <div className="vl-gate">
              <button type="button" className="vl-get" onClick={() => onUnlock(selected.id)}>Get this class for free</button>
            </div>
          ) : embedUrl ? (
            <iframe src={embedUrl} title={selected.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : selected.signedUrl ? (
            <video controls preload="metadata" src={selected.signedUrl}>Your browser does not support HTML video.</video>
          ) : (
            <div className="vl-placeholder">Video unavailable</div>
          )}
          <p className="vl-meta">VIDEO {selectedIndex + 1} OF {videos.length}</p>
          <h3>{selected.title}</h3>
          {selected.cleanDescription && <p className="vl-sub">{selected.cleanDescription}</p>}
          <div className="vl-player-actions">
            <button type="button" disabled={selectedIndex <= 0} onClick={() => setActiveVideoId(videos[selectedIndex - 1]?.id ?? null)}>← Previous</button>
            <button type="button" disabled={selectedIndex < 0 || selectedIndex >= videos.length - 1} onClick={() => setActiveVideoId(videos[selectedIndex + 1]?.id ?? null)}>Next →</button>
          </div>
        </div>
      )}

      <ol className="vl-list">
        {videos.map((video, index) => (
          <li key={video.id}>
            <button className={video.id === selected?.id ? "vl-item is-active" : "vl-item"} type="button" aria-pressed={video.id === selected?.id} onClick={() => setActiveVideoId(video.id)}>
              <span className="vl-number">{index + 1}</span>
              <span className="vl-item-copy"><strong>{video.title}</strong>{video.cleanDescription && <small>{video.cleanDescription}</small>}</span>
              <span className="vl-play-mark">{video.id === selected?.id ? "Playing" : "Play"}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
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
.vl-gate{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;max-height:600px;border-radius:12px;background:radial-gradient(ellipse at center,#123542 0%,#05080b 75%)}
.vl-get{padding:14px 26px;border:none;border-radius:999px;background:linear-gradient(90deg,#f5c542,#7fe7f2);color:#05222a;font-weight:700;font-size:17px;cursor:pointer}
.vl-get:hover{filter:brightness(1.1)}
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
.vl-card{padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(18,28,37,.88)}
.vl-message{padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:12px}
.vl-placeholder{aspect-ratio:16/9;display:grid;place-items:center;background:#05080b;border-radius:12px;color:rgba(232,241,245,.6)}
`;
