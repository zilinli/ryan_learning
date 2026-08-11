"use client";

import { useCallback, useState } from "react";
import { RYAN_ACCOUNT } from "@/lib/tenant-storage";

const GENRES = ["Indie", "Orchestral", "Hip-hop sketch", "Ballad"] as const;
type StageKind = "music" | "image" | "video";

export function LyricStudio() {
  const [draft, setDraft] = useState("");
  const [genre, setGenre] = useState<(typeof GENRES)[number]>("Indie");
  const [coach, setCoach] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [stageKind, setStageKind] = useState<StageKind>("music");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const runCoach = useCallback(async () => {
    setBusy("coach");
    setError(null);
    try {
      const res = await fetch("/api/lyric-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "coach", draft, genre }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        coach?: string;
        error?: string;
      };
      if (!res.ok || !data.coach) throw new Error(data.error || "Coach failed");
      setCoach(data.coach);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach failed");
    } finally {
      setBusy(null);
    }
  }, [draft, genre]);

  const structure = useCallback(async () => {
    setBusy("structure");
    setError(null);
    try {
      const res = await fetch("/api/lyric-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "structure", draft, genre }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        lyrics?: string;
        caption?: string;
        error?: string;
      };
      if (!res.ok || !data.lyrics)
        throw new Error(data.error || "Structure failed");
      setLyrics(data.lyrics);
      setCaption(data.caption || `${genre} mood`);
      if (!title.trim()) {
        setTitle(draft.split(/\n/)[0]?.slice(0, 48) || "Untitled song");
      }
      setStatus("Ready — save draft or Stage → song / image / video.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Structure failed");
    } finally {
      setBusy(null);
    }
  }, [draft, genre, title]);

  const saveLyricsOnly = useCallback(async () => {
    if (!lyrics.trim()) {
      setError("Structure lyrics first");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const res = await fetch("/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: RYAN_ACCOUNT,
          type: "song",
          title: title.trim() || "Untitled song",
          lyrics,
          caption,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved lyrics draft to My Creations.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }, [lyrics, caption, title]);

  const generate = useCallback(async () => {
    if (stageKind === "music" && (!lyrics.trim() || !caption.trim())) {
      setError("Need structured lyrics + style notes");
      return;
    }
    if (stageKind !== "music" && !caption.trim() && !lyrics.trim()) {
      setError("Add style notes or lyrics as the prompt");
      return;
    }
    setBusy("generate");
    setError(null);
    setStatus(
      stageKind === "music"
        ? "Generating song (deAPI → Bailian → Volc)…"
        : stageKind === "image"
          ? "Generating image via deAPI…"
          : "Generating video via deAPI…",
    );
    if (stageKind === "music") setAudioUrl(null);
    if (stageKind === "image") setImageUrl(null);
    if (stageKind === "video") setVideoUrl(null);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: stageKind,
          accountId: RYAN_ACCOUNT,
          title:
            title.trim() ||
            (stageKind === "music"
              ? "Untitled song"
              : stageKind === "image"
                ? "Untitled image"
                : "Untitled video"),
          lyrics,
          caption,
          prompt: caption || lyrics.slice(0, 400),
          gender,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        status?: string;
        url?: string;
        audioUrl?: string;
        provider?: string;
        model?: string;
        attempts?: string[];
      };
      if (res.status === 503 || data.status === "unconfigured") {
        setStatus(
          stageKind === "music"
            ? "未配置音乐服务 — 歌词仍可保存。请设 DEAPI_API_KEY。"
            : "未配置 DEAPI_API_KEY — 无法生成图片/视频。",
        );
        setError(data.error || "Provider unconfigured");
        return;
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Generate failed");
      }
      const url = data.url || data.audioUrl || null;
      if (stageKind === "music") setAudioUrl(url);
      if (stageKind === "image") setImageUrl(url);
      if (stageKind === "video") setVideoUrl(url);
      setStatus(
        `Ready (${data.provider || "deapi"}${data.model ? ` · ${data.model}` : ""}) — also in My Creations.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }, [lyrics, caption, title, gender, stageKind]);

  return (
    <div className="flex flex-1 flex-col bg-[var(--surface-muted)]">
      <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-5">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[var(--teal)]">
          Studio · Writing
        </p>
        <h2 className="mt-1 text-center text-2xl font-semibold text-[var(--ink)]">
          Write. Polish. Stage it.
        </h2>
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-0 md:grid-cols-2">
        {/* Notebook */}
        <div className="flex flex-col border-b border-[var(--line)] bg-[#f3efe6] p-4 dark:bg-[#2a2620] md:border-b-0 md:border-r">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Writing pad
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            placeholder="A scene, a feeling, a line you can't shake…"
            className="mt-2 min-h-[220px] flex-1 resize-y rounded-lg border border-[var(--line)] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[#1f1c18]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={`min-h-9 rounded-lg px-3 text-xs ${
                  genre === g
                    ? "bg-[var(--coral)] text-white"
                    : "border border-[var(--line)] text-[var(--ink-muted)]"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!draft.trim() || busy !== null}
              onClick={() => void runCoach()}
              className="min-h-11 rounded-lg bg-[var(--teal)] px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "coach" ? "Coaching…" : "Coach"}
            </button>
            <button
              type="button"
              disabled={!draft.trim() || busy !== null}
              onClick={() => void structure()}
              className="min-h-11 rounded-lg border border-[var(--teal)] px-4 text-sm font-medium text-[var(--teal)] disabled:opacity-40"
            >
              {busy === "structure" ? "Structuring…" : "Turn into lyrics"}
            </button>
          </div>
          {coach && (
            <div className="mt-4 rounded-lg border border-[var(--teal)]/30 bg-[var(--teal)]/10 p-3 text-sm leading-relaxed text-[var(--ink)]">
              {coach}
            </div>
          )}
        </div>

        {/* Stage · lyrics & text2X */}
        <div className="flex flex-col bg-[#1a2228] p-4 text-[#e8e2d8]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8fb896]">
              Stage · lyrics & media
            </label>
            <div className="flex gap-1 rounded-lg border border-white/15 p-0.5">
              {(
                [
                  ["music", "Song"],
                  ["image", "Image"],
                  ["video", "Video"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStageKind(id)}
                  className={`min-h-8 rounded-md px-2.5 text-[11px] font-medium ${
                    stageKind === id
                      ? "bg-[#8fb896] text-[#1a2228]"
                      : "text-[#a89f92] hover:text-[#e8e2d8]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="mt-2 min-h-11 rounded-lg border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#8fb896]"
          />
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={stageKind === "music" ? 8 : 5}
            placeholder="[Verse] / [Chorus] — also used as image/video prompt seed"
            className="mt-2 min-h-[120px] flex-1 resize-y rounded-lg border border-white/15 bg-black/30 p-3 font-mono text-xs leading-relaxed outline-none focus:border-[#8fb896]"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={
              stageKind === "music"
                ? "Style notes (deAPI caption / mood)"
                : "Prompt / style (deAPI text2X)"
            }
            className="mt-2 min-h-11 rounded-lg border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#8fb896]"
          />
          {stageKind === "music" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["female", "Female"],
                  ["male", "Male"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGender(id)}
                  className={`min-h-9 rounded-lg px-3 text-xs ${
                    gender === id
                      ? "bg-[#8fb896] text-[#1a2228]"
                      : "border border-white/20 text-[#a89f92]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {stageKind === "music" && (
            <div
              className="mt-4 flex h-16 items-end gap-0.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2"
              aria-hidden
            >
              {Array.from({ length: 48 }).map((_, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-[#8fb896]/50"
                  style={{
                    height: `${20 + ((i * 17) % 70)}%`,
                    opacity: audioUrl ? 0.9 : 0.35,
                    transition: "opacity 0.4s",
                  }}
                />
              ))}
            </div>
          )}
          {stageKind === "music" && audioUrl && (
            <audio controls src={audioUrl} className="mt-3 w-full" />
          )}
          {stageKind === "image" && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title || "Generated"}
              className="mt-3 max-h-56 w-full rounded-lg object-contain"
            />
          )}
          {stageKind === "video" && videoUrl && (
            <video controls src={videoUrl} className="mt-3 w-full rounded-lg" />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!lyrics.trim() || busy !== null}
              onClick={() => void saveLyricsOnly()}
              className="min-h-11 rounded-lg border border-white/25 px-4 text-sm disabled:opacity-40"
            >
              {busy === "save" ? "Saving…" : "Save lyrics"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void generate()}
              className="min-h-11 rounded-lg bg-[#a85f42] px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "generate"
                ? "Generating…"
                : stageKind === "music"
                  ? "Generate song"
                  : stageKind === "image"
                    ? "Generate image"
                    : "Generate video"}
            </button>
          </div>
          {status && <p className="mt-3 text-sm text-[#8fb896]">{status}</p>}
          {error && <p className="mt-2 text-sm text-[#e09a7a]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
