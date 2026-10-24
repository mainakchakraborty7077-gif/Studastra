export const LEARNING_CONTENT_BUCKET = "learning-content";

export type ContentSubject = "Physics" | "Chemistry" | "Mathematics" | "Biology";
export type ContentClass = "11" | "12";

export type LearningVideo = {
  id: string;
  title: string;
  description: string;
  subject: ContentSubject;
  class_level: ContentClass;
  youtube_url: string | null;
  file_path: string | null;
  published: boolean;
  created_at: string;
};

export type LearningNote = {
  id: string;
  title: string;
  summary: string;
  content: string;
  subject: ContentSubject;
  class_level: ContentClass;
  attachment_path: string | null;
  attachment_type: string | null;
  published: boolean;
  created_at: string;
};

export function getYouTubeEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      videoId =
        url.searchParams.get("v") ??
        url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ??
        "";
    } else {
      return null;
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
    return "https://www.youtube-nocookie.com/embed/" + videoId;
  } catch {
    return null;
  }
}
