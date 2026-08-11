"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FILE_INPUT_ACCEPT } from "@/lib/attachments";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import {
  buildVisualPrompt,
  looksLikeLyricStructure,
} from "@/lib/entertain/studio-structure";
import { compressImageDataUrl } from "@/lib/image-process";
import type { SttLang } from "@/lib/stt-lang";
import type { BasisCoachReport } from "@/lib/entertain/basis-writing";
import {
  buildWritingFixIssues,
  nextOpenFix,
  remainingFixCount,
  type WritingFixIssue,
} from "@/lib/entertain/basis-fix-session";
import { CameraCapture } from "./CameraCapture";
import { FileAttachControl } from "./FileAttachControl";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { useActiveStudioAccount } from "./StudioAccountBar";
import { WritingCoachPanel } from "./WritingCoachPanel";
import { WritingFixDialogue } from "./WritingFixDialogue";
import { WritingPadHighlights } from "./WritingPadHighlights";

const GENRES = ["Indie", "Orchestral", "Hip-hop sketch", "Ballad"] as const;
type StageKind = "music" | "image" | "video";

const STT_LANGS: SttLang[] = ["auto", "en", "zh", "yue", "es", "fr", "ms"];
const TEXT_FILE_EXT = /\.(txt|md|markdown|csv|json|log)$/i;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function WritingStudio() {
  const { accountId, name: accountName } = useActiveStudioAccount();
  const [draft, setDraft] = useState("");
  const [genre, setGenre] = useState<(typeof GENRES)[number]>("Indie");
  const [coach, setCoach] = useState<string | null>(null);
  const [coachReport, setCoachReport] = useState<BasisCoachReport | null>(null);
  const [fixIssues, setFixIssues] = useState<WritingFixIssue[]>([]);
  const [fixOpen, setFixOpen] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [stageKind, setStageKind] = useState<StageKind>("music");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [padStatus, setPadStatus] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sttLang, setSttLang] = useState<SttLang>("auto");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [liveCoachBusy, setLiveCoachBusy] = useState(false);

  const coachAbortRef = useRef<AbortController | null>(null);
  const coachGenRef = useRef(0);
  const lastRecordedCoachRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  const genreRef = useRef(genre);
  const titleRef = useRef(title);
  const accountIdRef = useRef(accountId);
  const stageKindRef = useRef(stageKind);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    genreRef.current = genre;
  }, [genre]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);
  useEffect(() => {
    stageKindRef.current = stageKind;
  }, [stageKind]);

  const appendToDraft = useCallback((text: string) => {
    const chunk = text.trim();
    if (!chunk) return;
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()}\n${chunk}` : chunk));
  }, []);

  const applyCoachResult = useCallback(
    (
      coachText: string,
      recordLearning: boolean,
      report?: BasisCoachReport | null,
    ) => {
      setCoach(coachText);
      if (report) {
        setCoachReport(report);
        const queue = buildWritingFixIssues(draftRef.current, report, 8);
        setFixIssues(queue);
        if (queue.length > 0) {
          setFixOpen(true);
          setShowHighlights(true);
        }
      } else {
        setCoachReport(null);
      }
      if (
        recordLearning &&
        coachText &&
        coachText !== lastRecordedCoachRef.current
      ) {
        lastRecordedCoachRef.current = coachText;
        void recordStudioLearningTurn({
          accountId: accountIdRef.current,
          source: "writing",
          title: titleRef.current.trim() || "Writing pad",
          userText: draftRef.current,
          assistantText: report?.summary || coachText,
        });
      }
    },
    [],
  );

  const runCoach = useCallback(
    async (opts?: { live?: boolean; signal?: AbortSignal; gen?: number }) => {
      const live = opts?.live === true;
      const signal = opts?.signal;
      const gen = opts?.gen;
      if (!live) {
        coachGenRef.current += 1;
        coachAbortRef.current?.abort();
        setLiveCoachBusy(false);
        setBusy("coach");
        setPadStatus(null);
      } else {
        setLiveCoachBusy(true);
        setPadStatus("Live coach…");
      }
      setError(null);
      try {
        const res = await fetch("/api/writing-studio/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "coach",
            draft: draftRef.current,
            genre: genreRef.current,
            target: stageKindRef.current,
          }),
          signal,
        });
        const data = (await res.json()) as {
          ok?: boolean;
          coach?: string;
          report?: BasisCoachReport;
          error?: string;
        };
        if (!res.ok || !data.coach) throw new Error(data.error || "Coach failed");
        applyCoachResult(data.coach, true, data.report ?? null);
        if (live && gen === coachGenRef.current) setPadStatus(null);
      } catch (e) {
        if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
          return;
        }
        setError(e instanceof Error ? e.message : "Coach failed");
        if (live && gen === coachGenRef.current) setPadStatus(null);
      } finally {
        if (!live) setBusy(null);
        else if (gen === coachGenRef.current) setLiveCoachBusy(false);
      }
    },
    [applyCoachResult],
  );

  // Live coach: debounce ~1.8s when draft ≥ 40 chars; abort on change
  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed.length < 40) {
      coachGenRef.current += 1;
      coachAbortRef.current?.abort();
      coachAbortRef.current = null;
      setLiveCoachBusy(false);
      setPadStatus((s) => (s === "Live coach…" ? null : s));
      return;
    }

    coachAbortRef.current?.abort();
    setLiveCoachBusy(false);
    setPadStatus((s) => (s === "Live coach…" ? null : s));
    const ac = new AbortController();
    coachAbortRef.current = ac;
    const gen = ++coachGenRef.current;
    const timer = window.setTimeout(() => {
      void runCoach({ live: true, signal: ac.signal, gen });
    }, 1800);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [draft, genre, stageKind, runCoach]);

  useEffect(() => {
    return () => {
      coachAbortRef.current?.abort();
    };
  }, []);

  const extractText = useCallback(
    async (body: {
      fileText?: string;
      images?: Array<{ name: string; mimeType: string; data: string }>;
    }) => {
      const res = await fetch("/api/writing-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extract", ...body }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        text?: string;
        error?: string;
      };
      if (!res.ok || !data.text) {
        throw new Error(data.error || "Could not extract text");
      }
      return data.text;
    },
    [],
  );

  const ingestImagePayload = useCallback(
    async (payload: { name: string; mimeType: string; data: string }) => {
      setBusy("ingest");
      setError(null);
      setPadStatus("Reading image…");
      try {
        const text = await extractText({
          images: [
            {
              name: payload.name,
              mimeType: payload.mimeType,
              data: payload.data,
            },
          ],
        });
        appendToDraft(text);
        setPadStatus("Added text from image.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ingest failed");
        setPadStatus(null);
      } finally {
        setBusy(null);
      }
    },
    [appendToDraft, extractText],
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy("ingest");
      setError(null);
      setPadStatus("Reading files…");
      try {
        for (const file of files) {
          const name = file.name || "upload";
          const isImage =
            file.type.startsWith("image/") ||
            /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(name);
          const isText =
            TEXT_FILE_EXT.test(name) ||
            (file.type.startsWith("text/") && !file.type.includes("html"));

          if (isImage) {
            setPadStatus(`Reading ${name}…`);
            const dataUrl = await readFileAsDataUrl(file);
            const compressed = await compressImageDataUrl(
              dataUrl,
              file.type || "image/jpeg",
            );
            const text = await extractText({
              images: [
                {
                  name: name.replace(/\.(heic|heif)$/i, ".jpg") || "photo.jpg",
                  mimeType: compressed.mimeType,
                  data: compressed.data,
                },
              ],
            });
            appendToDraft(text);
            continue;
          }

          if (isText) {
            setPadStatus(`Reading ${name}…`);
            const fileText = (await readFileAsText(file)).trim();
            if (!fileText) continue;
            // extract echoes fileText; keeps path consistent with API
            const text = await extractText({ fileText });
            appendToDraft(text);
            continue;
          }

          throw new Error(
            `Use a photo or text file (.txt, .md, .csv, .json, .log) — got ${name}`,
          );
        }
        setPadStatus("Added to writing pad.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ingest failed");
        setPadStatus(null);
      } finally {
        setBusy(null);
      }
    },
    [appendToDraft, extractText],
  );

  const structure = useCallback(async () => {
    setBusy("structure");
    setError(null);
    try {
      const res = await fetch("/api/writing-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "structure",
          draft,
          genre,
          target: stageKind,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        lyrics?: string;
        body?: string;
        caption?: string;
        prompt?: string;
        target?: string;
        error?: string;
      };
      const bodyText = String(data.body || data.lyrics || "").trim();
      if (!res.ok || !bodyText)
        throw new Error(data.error || "Structure failed");
      if (
        stageKind !== "music" &&
        looksLikeLyricStructure(bodyText)
      ) {
        throw new Error(
          "Structure still looks like lyrics — try Structure again for Image/Video",
        );
      }
      setLyrics(bodyText);
      setCaption(
        data.caption ||
          (stageKind === "music"
            ? `${genre} mood`
            : String(data.prompt || "").slice(0, 500) || `${genre} visual mood`),
      );
      if (!title.trim()) {
        const fallbackTitle =
          stageKind === "music"
            ? "Untitled song"
            : stageKind === "image"
              ? "Untitled image"
              : "Untitled video";
        setTitle(draft.split(/\n/)[0]?.slice(0, 48) || fallbackTitle);
      }
      setStatus(
        stageKind === "music"
          ? "Ready — lyrics structured for song."
          : stageKind === "image"
            ? "Ready — visual prompt structured for image."
            : "Ready — cinematic prompt structured for video.",
      );
      void recordStudioLearningTurn({
        accountId,
        source: "writing",
        title: title.trim() || draft.split(/\n/)[0]?.slice(0, 48) || "Writing",
        userText: draft,
        assistantText: bodyText,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Structure failed");
    } finally {
      setBusy(null);
    }
  }, [draft, genre, title, accountId, stageKind]);

  const saveDraftOnly = useCallback(async () => {
    if (!lyrics.trim()) {
      setError(
        stageKind === "music"
          ? "Structure lyrics first"
          : "Structure a visual prompt first",
      );
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const type =
        stageKind === "music"
          ? "song"
          : stageKind === "image"
            ? "image"
            : "video";
      const res = await fetch("/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          type,
          title:
            title.trim() ||
            (stageKind === "music"
              ? "Untitled song"
              : stageKind === "image"
                ? "Untitled image"
                : "Untitled video"),
          lyrics,
          caption,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setStatus(
        stageKind === "music"
          ? "Saved lyrics draft to My Creations."
          : "Saved Stage draft to My Creations.",
      );
      void recordStudioLearningTurn({
        accountId,
        source: "writing",
        title: title.trim() || "Untitled draft",
        userText: lyrics,
        assistantText: `${type} draft saved`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }, [lyrics, caption, title, accountId, stageKind]);

  const generate = useCallback(async () => {
    if (stageKind === "music" && (!lyrics.trim() || !caption.trim())) {
      setError("Need structured lyrics + style notes");
      return;
    }
    if (stageKind !== "music" && !lyrics.trim() && !caption.trim()) {
      setError("Structure a visual prompt (or add scene + style notes)");
      return;
    }
    const visualPrompt =
      stageKind === "music" ? "" : buildVisualPrompt(lyrics, caption);
    if (stageKind !== "music") {
      if (looksLikeLyricStructure(visualPrompt) || looksLikeLyricStructure(lyrics)) {
        setError(
          "Stage still looks like song lyrics — tap Structure for Image/Video first",
        );
        return;
      }
      if (visualPrompt.trim().length < 8) {
        setError("Visual prompt too short");
        return;
      }
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
          accountId,
          title:
            title.trim() ||
            (stageKind === "music"
              ? "Untitled song"
              : stageKind === "image"
                ? "Untitled image"
                : "Untitled video"),
          lyrics: stageKind === "music" ? lyrics : undefined,
          caption,
          prompt: stageKind === "music" ? caption : visualPrompt,
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
      if (stageKind === "music" || lyrics.trim()) {
        void recordStudioLearningTurn({
          accountId,
          source: "writing",
          title: title.trim() || "Stage piece",
          userText: lyrics || caption,
          assistantText: `Generated ${stageKind} via ${data.provider || "deapi"}`,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }, [lyrics, caption, title, gender, stageKind, accountId]);

  const padLocked = busy !== null;
  const activeFix = nextOpenFix(fixIssues);
  const openFixCount = remainingFixCount(fixIssues);
  const gridClass = fixOpen
    ? "mx-auto grid w-full max-w-6xl flex-1 gap-0 lg:grid-cols-[minmax(260px,0.95fr)_minmax(280px,1.1fr)_minmax(280px,1fr)]"
    : "mx-auto grid w-full max-w-5xl flex-1 gap-0 md:grid-cols-2";

  return (
    <div className="flex flex-1 flex-col bg-[var(--surface-muted)]">
      <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-5">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[var(--teal)]">
          Studio · Writing
        </p>
        <h2 className="mt-1 text-center text-2xl font-semibold text-[var(--ink)]">
          Write. Polish. Stage it.
        </h2>
        <p className="mt-2 text-center text-[11px] text-[var(--ink-muted)]">
          For {accountName} · Coach opens a fix dialogue by severity · writing
          turns update ELA skills
        </p>
      </div>

      <div className={gridClass}>
        {fixOpen && (
          <WritingFixDialogue
            issues={fixIssues}
            draft={draft}
            onIssuesChange={setFixIssues}
            onDraftChange={setDraft}
            onClose={() => setFixOpen(false)}
          />
        )}

        <div className="flex flex-col border-b border-[var(--line)] bg-[#f3efe6] p-4 dark:bg-[#2a2620] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Writing pad
            </label>
            <div className="flex items-center gap-2">
              {openFixCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFixOpen(true)}
                  className="relative inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--coral)]/40 bg-[var(--coral)]/10 px-2.5 text-[11px] font-semibold text-[var(--coral)]"
                  title="Open fix dialogue"
                >
                  Issues
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--coral)] text-[10px] text-white">
                    {openFixCount}
                  </span>
                </button>
              )}
              {fixIssues.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHighlights((v) => !v)}
                  className="min-h-9 rounded-lg px-2 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  {showHighlights ? "Edit text" : "Show marks"}
                </button>
              )}
            </div>
          </div>

          {showHighlights && fixIssues.some((i) => i.status === "open") ? (
            <div className="mt-2 space-y-2">
              <WritingPadHighlights
                draft={draft}
                issues={fixIssues}
                activeId={activeFix?.id}
                className="min-h-[180px]"
              />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                placeholder="Edit here if you need a free rewrite…"
                className="min-h-[100px] w-full resize-y rounded-lg border border-[var(--line)] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[#1f1c18]"
              />
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              placeholder="A scene, a feeling, a line you can't shake… or speak / attach / snap"
              className="mt-2 min-h-[220px] flex-1 resize-y rounded-lg border border-[var(--line)] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[#1f1c18]"
            />
          )}
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

          <div className="mt-2 flex flex-wrap gap-1">
            {STT_LANGS.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSttLang(lang)}
                className={`min-h-7 rounded-md px-2 text-[10px] uppercase tracking-wide ${
                  sttLang === lang
                    ? "bg-[var(--teal)] text-white"
                    : "border border-[var(--line)] text-[var(--ink-muted)]"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <MicTranscribeButton
              language={sttLang}
              disabled={padLocked}
              compact
              onTranscript={(t) => {
                const chunk = t.trim();
                if (!chunk) return;
                setDraft((prev) => (prev.trim() ? `${prev}\n${chunk}` : chunk));
              }}
            />
            <FileAttachControl
              disabled={padLocked}
              desktopAccept={FILE_INPUT_ACCEPT}
              title="Attach photo or text"
              ariaLabel="Attach photo or text"
              className="rounded-lg border border-[var(--line)] px-3 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
              onFiles={(files) => void onFiles(files)}
            >
              File
            </FileAttachControl>
            <button
              type="button"
              disabled={padLocked}
              onClick={() => setCameraOpen(true)}
              className="min-h-11 rounded-lg border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-3 text-xs font-semibold text-[var(--teal)] disabled:opacity-40"
            >
              Camera
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!draft.trim() || padLocked}
              onClick={() => void runCoach()}
              className="min-h-11 rounded-lg bg-[var(--teal)] px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === "coach" ? "Coaching…" : "Coach"}
            </button>
            <button
              type="button"
              disabled={!draft.trim() || padLocked}
              onClick={() => void structure()}
              className="min-h-11 rounded-lg border border-[var(--teal)] px-4 text-sm font-medium text-[var(--teal)] disabled:opacity-40"
            >
              {busy === "structure"
                ? "Structuring…"
                : stageKind === "music"
                  ? "Turn into lyrics"
                  : stageKind === "image"
                    ? "Structure for image"
                    : "Structure for video"}
            </button>
          </div>

          {(padStatus || liveCoachBusy || busy === "ingest") && (
            <p className="mt-2 text-[11px] text-[var(--teal)]">
              {busy === "ingest" && !padStatus
                ? "Reading…"
                : padStatus || (liveCoachBusy ? "Live coach…" : null)}
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-[var(--coral)] md:hidden">{error}</p>
          )}

          {coachReport ? (
            <WritingCoachPanel report={coachReport} fallbackText={coach} />
          ) : coach ? (
            <div className="mt-4 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/10 p-3 text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">
              {coach}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col bg-[#1a2228] p-4 text-[#e8e2d8]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8fb896]">
              Stage ·{" "}
              {stageKind === "music"
                ? "lyrics & song"
                : stageKind === "image"
                  ? "image prompt"
                  : "video prompt"}
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
            placeholder={
              stageKind === "music"
                ? "[Verse] / [Chorus] structured lyrics"
                : stageKind === "image"
                  ? "Visual scene — subject, setting, mood (no lyric tags)"
                  : "Cinematic scene — subject, action, camera move (no lyric tags)"
            }
            className="mt-2 min-h-[120px] flex-1 resize-y rounded-lg border border-white/15 bg-black/30 p-3 font-mono text-xs leading-relaxed outline-none focus:border-[#8fb896]"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={
              stageKind === "music"
                ? "Style notes (deAPI caption / mood)"
                : stageKind === "image"
                  ? "Style notes — lighting, medium, composition"
                  : "Style notes — motion, lighting, cinematic feel"
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
            <audio
              controls
              playsInline
              preload="metadata"
              src={audioUrl}
              className="mt-3 w-full"
            />
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
              onClick={() => void saveDraftOnly()}
              className="min-h-11 rounded-lg border border-white/25 px-4 text-sm disabled:opacity-40"
            >
              {busy === "save"
                ? "Saving…"
                : stageKind === "music"
                  ? "Save lyrics"
                  : "Save draft"}
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

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(payload) => {
          setCameraOpen(false);
          void ingestImagePayload({
            name: `pad-photo-${Date.now()}.jpg`,
            mimeType: payload.mimeType,
            data: payload.data,
          });
        }}
      />
    </div>
  );
}
