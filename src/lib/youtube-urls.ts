/**
 * Client-safe YouTube URL helpers — used by BBC, RSA, and TED components.
 * Separated from youtube-transcript.ts to avoid pulling node:fs into client bundles.
 */

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function extractYouTubeId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      if (u.hostname.includes("youtu.be"))
        return u.pathname.replace(/^\//, "").split("/")[0] || null;
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/");
      const last = parts[parts.length - 1];
      if (last && /^[A-Za-z0-9_-]{11}$/.test(last)) return last;
    }
  } catch {
    // invalid URL
  }
  return null;
}
