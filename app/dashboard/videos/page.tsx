"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getYouTubeEmbedUrl,
  LEARNING_CONTENT_BUCKET,
  type LearningVideo,
} from "@/lib/learning-content";

type VideoWithUrl = LearningVideo & { signedUrl: string | null };
const VIDEO_SELECT =
  "id,title,description,subject,class_level,youtube_url,file_path,published,created_at";

export default function StudentVideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
        .order("created_at", { ascending: false });

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
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load videos. Please try again.",
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="vl-page">
      <style>{styles}</style>
      <div className="vl-wrap">
        <Link href="/dashboard" className="vl-back">
          ← Back to dashboard
        </Link>
        <header>
          <p className="vl-kicker">STUDY LIBRARY</p>
          <h1>Educational videos</h1>
          <p className="vl-sub">Class 11 and 12 videos selected for your PCMB studies.</p>
        </header>

        {loading && <p role="status">Loading videos...</p>}
        {message && <p className="vl-message" role="status">{message}</p>}
        {!loading && !message && videos.length === 0 && (
          <section className="vl-card">No videos are published yet.</section>
        )}

        <div className="vl-grid">
          {videos.map((video) => {
            const embedUrl = video.youtube_url
              ? getYouTubeEmbedUrl(video.youtube_url)
              : null;

            return (
              <article className="vl-card" key={video.id}>
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : video.signedUrl ? (
                  <video controls preload="metadata" src={video.signedUrl}>
                    Your browser does not support HTML video.
                  </video>
                ) : (
                  <div className="vl-placeholder">Video unavailable</div>
                )}
                <p className="vl-meta">Class {video.class_level} · {video.subject}</p>
                <h2>{video.title}</h2>
                {video.description && <p className="vl-sub">{video.description}</p>}
              </article>
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
.vl-wrap header{margin:30px 0}
.vl-kicker{font-size:12px;letter-spacing:.14em;color:#7fe7f2}
.vl-wrap h1{margin:8px 0;font-size:34px}
.vl-sub{color:rgba(232,241,245,.65);line-height:1.6}
.vl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.vl-card{padding:18px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(18,28,37,.88)}
.vl-card iframe,.vl-card video{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#05080b}
.vl-card h2{font-size:18px;margin:10px 0 4px}
.vl-card p{margin:6px 0}
.vl-meta{font-size:12px;color:#7fe7f2}
.vl-message{padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:12px}
.vl-placeholder{aspect-ratio:16/9;display:grid;place-items:center;background:#05080b;border-radius:12px;color:rgba(232,241,245,.6)}
`;
