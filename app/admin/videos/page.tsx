"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminShell from "@/components/AdminShell";
import { createClient } from "@/lib/supabase/client";
import {
  getYouTubeEmbedUrl,
  LEARNING_CONTENT_BUCKET,
  type ContentClass,
  type ContentSubject,
  type LearningVideo,
} from "@/lib/learning-content";

const SUBJECTS: ContentSubject[] = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
];
const CLASSES: ContentClass[] = ["11", "12"];
const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  ogg: "video/ogg",
  ogv: "video/ogg",
  "3gp": "video/3gpp",
};
const VIDEO_ACCEPT = ".mp4,.webm,.mov,.avi,.mpeg,.mpg,.ogg,.ogv,.3gp,video/*";
const VIDEO_SELECT =
  "id,title,description,subject,class_level,youtube_url,file_path,published,created_at";

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<LearningVideo[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<ContentSubject>("Physics");
  const [classLevel, setClassLevel] = useState<ContentClass>("11");
  const [sourceType, setSourceType] = useState<"youtube" | "file">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading videos...");

  async function loadVideos() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("learning_videos")
      .select(VIDEO_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setVideos((data ?? []) as LearningVideo[]);
    setMessage("");
  }

  useEffect(() => {
    void loadVideos().catch((error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load videos. Run the learning library SQL setup first.",
      ),
    );
  }, []);

  async function addVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    let uploadedPath: string | null = null;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");

      if (sourceType === "youtube" && !getYouTubeEmbedUrl(youtubeUrl)) {
        throw new Error("Enter a valid YouTube video link.");
      }

      if (sourceType === "file") {
        const extension = file?.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        const contentType = extension ? VIDEO_MIME_BY_EXTENSION[extension] : null;
        if (!file || !contentType) {
          throw new Error(
            "Choose a supported video file: MP4, WebM, MOV, AVI, MPEG, OGG, or 3GP.",
          );
        }
        if (file.size > 200 * 1024 * 1024) {
          throw new Error("The video must be 200 MB or smaller.");
        }

        uploadedPath = "videos/" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabase.storage
          .from(LEARNING_CONTENT_BUCKET)
          .upload(uploadedPath, file, {
            contentType,
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from("learning_videos")
        .insert({
          title: title.trim(),
          description: description.trim(),
          subject,
          class_level: classLevel,
          youtube_url: sourceType === "youtube" ? youtubeUrl.trim() : null,
          file_path: uploadedPath,
          published,
          created_by: user.id,
        })
        .select(VIDEO_SELECT)
        .single();

      if (error) throw error;

      setVideos((current) => [data as LearningVideo, ...current]);
      setTitle("");
      setDescription("");
      setYoutubeUrl("");
      setFile(null);
      const fileInput = document.getElementById(
        "video-file",
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setMessage("Video added to the library.");
    } catch (error) {
      if (uploadedPath) {
        await createClient()
          .storage.from(LEARNING_CONTENT_BUCKET)
          .remove([uploadedPath]);
      }
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add this video. Check the Supabase learning library setup.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteVideo(video: LearningVideo) {
    const supabase = createClient();
    const { error } = await supabase
      .from("learning_videos")
      .delete()
      .eq("id", video.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (video.file_path) {
      await supabase.storage
        .from(LEARNING_CONTENT_BUCKET)
        .remove([video.file_path]);
    }
    setVideos((current) => current.filter((item) => item.id !== video.id));
    setMessage("Video removed.");
  }

  async function togglePublished(video: LearningVideo) {
    const supabase = createClient();
    const { error } = await supabase
      .from("learning_videos")
      .update({ published: !video.published })
      .eq("id", video.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setVideos((current) =>
      current.map((item) =>
        item.id === video.id ? { ...item, published: !video.published } : item,
      ),
    );
  }

  return (
    <AdminShell
      title="Video editor"
      subtitle="Add educational YouTube videos or upload video files for students."
    >
      <form onSubmit={addVideo} className="ad-card ad-form">
        <div>
          <label htmlFor="video-title">Video title</label>
          <input
            id="video-title"
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="video-subject">Subject</label>
          <select
            id="video-subject"
            value={subject}
            onChange={(event) =>
              setSubject(event.target.value as ContentSubject)
            }
          >
            {SUBJECTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="video-class">Class</label>
          <select
            id="video-class"
            value={classLevel}
            onChange={(event) =>
              setClassLevel(event.target.value as ContentClass)
            }
          >
            {CLASSES.map((item) => (
              <option key={item} value={item}>
                Class {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="video-source">Video source</label>
          <select
            id="video-source"
            value={sourceType}
            onChange={(event) => {
              setSourceType(event.target.value as "youtube" | "file");
              setFile(null);
            }}
          >
            <option value="youtube">YouTube link</option>
            <option value="file">Upload video file</option>
          </select>
        </div>
        {sourceType === "youtube" ? (
          <div className="full">
            <label htmlFor="youtube-url">YouTube URL</label>
            <input
              id="youtube-url"
              type="url"
              required
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
        ) : (
          <div className="full">
            <label htmlFor="video-file">
              Video file (MP4, WebM, MOV, AVI, MPEG, OGG, or 3GP; up to 200 MB)
            </label>
            <input
              id="video-file"
              type="file"
              accept={VIDEO_ACCEPT}
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
        )}
        <div className="full">
          <label htmlFor="video-description">Description</label>
          <textarea
            id="video-description"
            rows={3}
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <label className="full">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />{" "}
          Publish for students
        </label>
        <div className="full">
          <button className="ad-btn" disabled={busy}>
            {busy ? "Saving..." : "Add video"}
          </button>
        </div>
        {message && (
          <p className="ad-msg full" role="status" aria-live="polite">
            {message}
          </p>
        )}
      </form>

      <section className="ad-card">
        <h2>Video library</h2>
        {videos.length === 0 ? (
          <p className="ad-sub">No videos added yet.</p>
        ) : (
          videos.map((video) => (
            <article className="ad-q" key={video.id}>
              <p>
                <strong>{video.title}</strong>
              </p>
              <p className="ad-meta">
                Class {video.class_level} · {video.subject} ·{" "}
                {video.youtube_url ? "YouTube" : "Video file"} ·{" "}
                {video.published ? "Published" : "Draft"}
              </p>
              <div>
                <button
                  type="button"
                  className="ad-ghost"
                  onClick={() => void togglePublished(video)}
                >
                  {video.published ? "Unpublish" : "Publish"}
                </button>{" "}
                <button
                  type="button"
                  className="ad-ghost"
                  onClick={() => void deleteVideo(video)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </AdminShell>
  );
}
