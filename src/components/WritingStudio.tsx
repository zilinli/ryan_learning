"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FILE_INPUT_ACCEPT } from "@/lib/attachments";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import {
  buildVisualPrompt,
  looksLikeLyricStructure,
} from "@/lib/entertain/studio-structure";
import { estimateVideoDurationSec } from "@/lib/deapi-client";
import { compressImageDataUrl } from "@/lib/image-process";
import type { SttLang } from "@/lib/stt-lang";
import type { BasisCoachReport, WritingType } from "@/lib/entertain/basis-writing";
import {
  draftStats,
  structureCtaLabel,
  WRITING_TYPES,
} from "@/lib/entertain/basis-writing";
import {
  normalizeStageStyle,
  styleCaptionSeed,
  stylesForTarget,
  type StageStyleTarget,
} from "@/lib/entertain/stage-styles";
import {
  buildWritingFixIssues,
  nextOpenFix,
  remainingFixCount,
  type WritingFixIssue,
} from "@/lib/entertain/basis-fix-session";
import {
  applyGrammarReplacement,
  type GrammarMatch,
} from "@/lib/entertain/languagetool";
import { CameraCapture } from "./CameraCapture";
import { FileAttachControl } from "./FileAttachControl";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { useActiveStudioAccount } from "./StudioAccountBar";
import { WritingCoachPanel } from "./WritingCoachPanel";
import { WritingFixDialogue } from "./WritingFixDialogue";
import { WritingMentorDialogue } from "./WritingMentorDialogue";
import { WritingPadHighlights } from "./WritingPadHighlights";

type StageKind = "music" | "image" | "video";
type MobileTab = "write" | "feedback" | "stage";
const STAGE_EXPANDED_KEY = "spark.ws.stageExpanded";

const STT_LANG_OPTIONS: Array<{ id: SttLang; label: string }> = [
  { id: "auto", label: "Auto detect" },
  { id: "en", label: "English" },
  { id: "zh", label: "中文 (普通话)" },
  { id: "yue", label: "粵語" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "ms", label: "Bahasa Melayu" },
];

const TEXT_FILE_EXT = /\.(txt|md|markdown|csv|json|log)$/i;

const selectClass =
  "min-h-10 max-w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--ink)] outline-none focus:border-[var(--teal)]";

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
  const [writingType, setWritingType] = useState<WritingType>("narrative");
  const [genre, setGenre] = useState("Indie");
  const [journalId, setJournalId] = useState<string | null>(null);
  const [journalDate, setJournalDate] = useState<string | null>(null);
  const [journalSaving, setJournalSaving] = useState(false);
  const [coach, setCoach] = useState<string | null>(null);
  const [coachReport, setCoachReport] = useState<BasisCoachReport | null>(null);
  const [fixIssues, setFixIssues] = useState<WritingFixIssue[]>([]);
  const [fixOpen, setFixOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [mentorSessionKey, setMentorSessionKey] = useState(0);
  const [mentorUserActive, setMentorUserActive] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [grammarMatches, setGrammarMatches] = useState<GrammarMatch[]>([]);
  const [activeGrammarKey, setActiveGrammarKey] = useState<string | null>(null);
  const [grammarTip, setGrammarTip] = useState<GrammarMatch | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [stageKind, setStageKind] = useState<StageKind>("music");
  const [stageExpanded, setStageExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("write");
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
  const lastAutoMentorDraftRef = useRef<string>("");
  const mentorUserActiveRef = useRef(false);
  const mentorOpenRef = useRef(false);
  const draftRef = useRef(draft);
  const genreRef = useRef(genre);
  const writingTypeRef = useRef(writingType);
  const titleRef = useRef(title);
  const accountIdRef = useRef(accountId);
  const stageKindRef = useRef(stageKind);
  const padTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const captionTouchedRef = useRef(false);
  const captionRef = useRef(caption);
  const journalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    genreRef.current = genre;
  }, [genre]);
  useEffect(() => {
    captionRef.current = caption;
  }, [caption]);
  useEffect(() => {
    writingTypeRef.current = writingType;
  }, [writingType]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);
  useEffect(() => {
    stageKindRef.current = stageKind;
    setGenre((prev) => {
      const list = stylesForTarget(stageKind);
      return list.includes(prev) ? prev : normalizeStageStyle(stageKind, prev);
    });
  }, [stageKind]);
  useEffect(() => {
    mentorUserActiveRef.current = mentorUserActive;
  }, [mentorUserActive]);
  useEffect(() => {
    mentorOpenRef.current = mentorOpen;
  }, [mentorOpen]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(STAGE_EXPANDED_KEY);
      if (raw === "1") setStageExpanded(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        STAGE_EXPANDED_KEY,
        stageExpanded ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [stageExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const jid = q.get("journal") || "";
    const wt = q.get("writingType") || "";
    if (wt === "journal") setWritingType("journal");
    if (!jid) return;
    let cancelled = false;
    void fetch(
      `/api/journal?accountId=${encodeURIComponent(accountId)}&id=${encodeURIComponent(jid)}`,
    )
      .then((r) => r.json())
      .then((data: { item?: { id: string; body?: string; date?: string; title?: string } }) => {
        if (cancelled || !data.item) return;
        setJournalId(data.item.id);
        setJournalDate(data.item.date || null);
        setWritingType("journal");
        if (data.item.body) setDraft(data.item.body);
        if (data.item.title && !titleRef.current.trim()) {
          setTitle(data.item.title);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
    // accountId only — don't re-fetch on every title change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const saveJournal = useCallback(
    async (body: string) => {
      if (!journalId) return;
      setJournalSaving(true);
      try {
        await fetch("/api/journal", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: accountIdRef.current,
            id: journalId,
            body,
            title: titleRef.current.trim() || undefined,
            date: journalDate || undefined,
          }),
        });
      } catch {
        /* ignore autosave */
      } finally {
        setJournalSaving(false);
      }
    },
    [journalId, journalDate],
  );

  useEffect(() => {
    if (!journalId) return;
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current);
    journalTimerRef.current = setTimeout(() => {
      void saveJournal(draft);
    }, 2000);
    return () => {
      if (journalTimerRef.current) clearTimeout(journalTimerRef.current);
    };
  }, [draft, journalId, saveJournal]);

  // Debounced grammar check (~800ms)
  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed.length < 12) {
      setGrammarMatches([]);
      setGrammarTip(null);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/writing-studio/grammar-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: draft, language: "en-US" }),
            signal: ac.signal,
          });
          const data = (await res.json()) as {
            ok?: boolean;
            matches?: GrammarMatch[];
          };
          if (!res.ok || !data.ok) return;
          setGrammarMatches(Array.isArray(data.matches) ? data.matches : []);
        } catch {
          /* ignore abort / network */
        }
      })();
    }, 800);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [draft]);

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
      opts?: { openMentor?: boolean; forceNewSession?: boolean },
    ) => {
      setCoach(coachText);
      if (report) {
        setCoachReport(report);
        const queue = buildWritingFixIssues(draftRef.current, report, 8);
        setFixIssues(queue);
      } else {
        setCoachReport(null);
        setFixIssues([]);
      }
      if (opts?.openMentor) {
        const draftSnap = draftRef.current.trim();
        const force = opts.forceNewSession === true;
        const midChat = mentorUserActiveRef.current && mentorOpenRef.current;
        if (force || !midChat) {
          if (
            force ||
            !mentorOpenRef.current ||
            draftSnap !== lastAutoMentorDraftRef.current
          ) {
            setMentorSessionKey((k) => k + 1);
            lastAutoMentorDraftRef.current = draftSnap;
            setMentorUserActive(false);
          }
          setMentorOpen(true);
          setFixOpen(false);
          setShowHighlights(false);
          setMobileTab("feedback");
          padTextareaRef.current?.blur();
        }
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
    async (opts?: {
      live?: boolean;
      signal?: AbortSignal;
      gen?: number;
      manual?: boolean;
    }) => {
      const live = opts?.live === true;
      const manual = opts?.manual === true;
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
        setPadStatus("Coach ready soon…");
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
            writingType: writingTypeRef.current,
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
        applyCoachResult(data.coach, true, data.report ?? null, {
          openMentor: manual || live,
          forceNewSession: manual,
        });
        if (manual) {
          setMobileTab("feedback");
          padTextareaRef.current?.blur();
        }
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

  // Auto-coach after writing pause (~3.2s, ≥40 chars)
  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed.length < 40) {
      coachGenRef.current += 1;
      coachAbortRef.current?.abort();
      coachAbortRef.current = null;
      setLiveCoachBusy(false);
      setPadStatus((s) =>
        s === "Coach ready soon…" || s === "Live coach…" ? null : s,
      );
      return;
    }

    coachAbortRef.current?.abort();
    setLiveCoachBusy(false);
    setPadStatus((s) =>
      s === "Coach ready soon…" || s === "Live coach…" ? null : s,
    );
    const ac = new AbortController();
    coachAbortRef.current = ac;
    const gen = ++coachGenRef.current;
    const timer = window.setTimeout(() => {
      void runCoach({ live: true, signal: ac.signal, gen });
    }, 3200);

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
    setStageExpanded(true);
    setMobileTab("stage");
    try {
      const res = await fetch("/api/writing-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "structure",
          draft,
          genre,
          writingType,
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
        suggestedStyle?: string;
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
      const suggested = normalizeStageStyle(
        stageKind as StageStyleTarget,
        data.suggestedStyle || genre,
      );
      setGenre(suggested);
      setLyrics(bodyText);
      const nextCaption = captionTouchedRef.current
        ? captionRef.current
        : data.caption ||
          styleCaptionSeed(stageKind, suggested, gender) ||
          (stageKind === "music"
            ? `${suggested} mood`
            : String(data.prompt || "").slice(0, 500) || `${suggested} visual mood`);
      setCaption(nextCaption);
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
  }, [draft, genre, writingType, title, accountId, stageKind]);

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
      notifyCreationsChanged(accountId);
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
        durationSec?: number;
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
      const durLabel =
        typeof data.durationSec === "number" ? ` · ~${data.durationSec}s` : "";
      setStatus(
        `Ready (${data.provider || "deapi"}${data.model ? ` · ${data.model}` : ""}${durLabel}) — also in My Creations.`,
      );
      notifyCreationsChanged(accountId);
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

  const onGrammarClick = useCallback((match: GrammarMatch, key: string) => {
    setActiveGrammarKey(key);
    setGrammarTip(match);
  }, []);

  const applyGrammarFix = useCallback(
    (replacement: string) => {
      if (!grammarTip) return;
      setDraft((prev) => applyGrammarReplacement(prev, grammarTip, replacement));
      setGrammarTip(null);
      setActiveGrammarKey(null);
    },
    [grammarTip],
  );

  const padLocked = busy !== null;
  const activeFix = nextOpenFix(fixIssues);
  const openFixCount = remainingFixCount(fixIssues);
  const liveStats = draftStats(draft);
  const stageStyles = stylesForTarget(stageKind);
  const openSpotMarks = showHighlights && fixIssues.some((i) => i.status === "open");
  const showGrammarOverlay =
    !openSpotMarks && grammarMatches.length > 0 && showHighlights;
  const showMarksPane = openSpotMarks || showGrammarOverlay;

  const feedbackBody = (
    <>
      {mentorOpen && !fixOpen && (
        <div className="mt-1">
          <WritingMentorDialogue
            report={coachReport}
            coachText={coach}
            draft={draft}
            genre={genre}
            target={stageKind}
            sessionKey={mentorSessionKey}
            onDraftChange={setDraft}
            onClose={() => setMentorOpen(false)}
            onUserActiveChange={setMentorUserActive}
            spotFixCount={openFixCount}
            onOpenSpotFixes={() => {
              setFixOpen(true);
              setShowHighlights(true);
              setMobileTab("write");
            }}
          />
        </div>
      )}
      {fixOpen && (
        <div className="mt-1">
          <WritingFixDialogue
            issues={fixIssues}
            draft={draft}
            onIssuesChange={setFixIssues}
            onDraftChange={setDraft}
            onClose={() => {
              setFixOpen(false);
              if (coachReport || coach) setMentorOpen(true);
            }}
          />
        </div>
      )}
      {!mentorOpen &&
        !fixOpen &&
        (coachReport ? (
          <WritingCoachPanel
            report={coachReport}
            fallbackText={coach}
            onTalk={() => {
              setFixOpen(false);
              setMentorOpen(true);
            }}
          />
        ) : coach ? (
          <div className="mt-2 space-y-2 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/10 p-3 text-sm leading-relaxed text-[var(--ink)]">
            <p className="whitespace-pre-wrap">{coach}</p>
            <button
              type="button"
              onClick={() => setMentorOpen(true)}
              className="min-h-10 rounded-xl bg-[var(--teal)] px-3 text-sm font-semibold text-white"
            >
              Answer in coach chat
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Tap <span className="font-semibold text-[var(--teal)]">Coach</span>{" "}
            after a few lines — feedback lands here so you can keep writing.
          </p>
        ))}
    </>
  );

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
          For {accountName} · pauses ~3s to auto-coach · or tap Coach anytime
        </p>
      </div>

      <div className="flex border-b border-[var(--line)] bg-[var(--surface)] md:hidden">
        {(
          [
            ["write", "Write"],
            ["feedback", "Feedback"],
            ["stage", "Stage"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={`min-h-11 flex-1 text-sm font-semibold ${
              mobileTab === id
                ? "border-b-2 border-[var(--teal)] text-[var(--teal)]"
                : "text-[var(--ink-muted)]"
            }`}
          >
            {label}
            {id === "feedback" && (coachReport || coach) ? (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-0 md:grid-cols-2">
        <div
          className={`${
            mobileTab === "write" ? "flex" : "hidden"
          } flex-col border-b border-[var(--line)] bg-[#f3efe6] p-4 dark:bg-[#2a2620] md:flex md:border-b-0 md:border-r`}
        >
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Writing pad
            </label>
            <div className="flex items-center gap-2">
              {(coachReport || coach) && (
                <button
                  type="button"
                  onClick={() => {
                    setFixOpen(false);
                    setMentorOpen(true);
                    setMobileTab("feedback");
                  }}
                  className="min-h-9 rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-2.5 text-[11px] font-semibold text-[var(--teal)]"
                  title="Open Spark coach chat"
                >
                  Chat
                </button>
              )}
              {openFixCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMentorOpen(false);
                    setFixOpen(true);
                    setShowHighlights(true);
                    setMobileTab("write");
                  }}
                  className="relative inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--coral)]/40 bg-[var(--coral)]/10 px-2.5 text-[11px] font-semibold text-[var(--coral)]"
                  title="Optional spot fixes"
                >
                  Spots
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--coral)] text-[10px] text-white">
                    {openFixCount}
                  </span>
                </button>
              )}
              {(fixIssues.length > 0 || grammarMatches.length > 0) && (
                <button
                  type="button"
                  onClick={() => setShowHighlights((v) => !v)}
                  className="min-h-9 rounded-lg px-2 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  {showHighlights
                    ? "Edit text"
                    : grammarMatches.length > 0
                      ? `Marks · ${grammarMatches.length}`
                      : "Show marks"}
                </button>
              )}
            </div>
          </div>

          {showMarksPane ? (
            <div className="mt-2 space-y-2">
              <WritingPadHighlights
                draft={draft}
                issues={openSpotMarks ? fixIssues : []}
                grammarMatches={grammarMatches}
                activeId={activeFix?.id}
                activeGrammarKey={activeGrammarKey}
                onGrammarClick={onGrammarClick}
                className="min-h-[180px]"
              />
              <textarea
                ref={padTextareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                placeholder="Edit here if you need a free rewrite…"
                className="min-h-[100px] w-full resize-y rounded-lg border border-[var(--line)] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[#1f1c18]"
              />
            </div>
          ) : (
            <textarea
              ref={padTextareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              placeholder="A scene, a feeling, a line you can't shake… or speak / attach / snap"
              className="mt-2 min-h-[220px] flex-1 resize-y rounded-lg border border-[var(--line)] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[#1f1c18]"
            />
          )}

          <p className="mt-1.5 text-[11px] tabular-nums text-[var(--ink-muted)]">
            {liveStats.words} words · {liveStats.sentences} sentences
            {grammarMatches.length > 0
              ? ` · ${grammarMatches.length} grammar mark${grammarMatches.length === 1 ? "" : "s"}`
              : ""}
          </p>

          {grammarTip && (
            <div className="mt-2 rounded-xl border border-[var(--teal)]/35 bg-[var(--surface)] p-3 text-sm text-[var(--ink)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                {grammarTip.category}
              </p>
              <p className="mt-1 leading-snug">{grammarTip.message}</p>
              {grammarTip.replacements.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {grammarTip.replacements.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => applyGrammarFix(r)}
                      className="min-h-9 rounded-lg bg-[var(--teal)] px-2.5 text-xs font-semibold text-white"
                    >
                      {r === " " ? "Single space" : r}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setGrammarTip(null);
                  setActiveGrammarKey(null);
                }}
                className="mt-2 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)]/80 p-2.5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="ws-writing-type">
                Writing type
              </label>
              <select
                id="ws-writing-type"
                value={writingType}
                onChange={(e) =>
                  setWritingType(e.target.value as WritingType)
                }
                className={`${selectClass} min-w-[8.5rem] flex-1 sm:flex-none`}
                title="Writing type"
              >
                {WRITING_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="ws-stt-lang">
                Mic language
              </label>
              <select
                id="ws-stt-lang"
                value={sttLang}
                onChange={(e) => setSttLang(e.target.value as SttLang)}
                className={`${selectClass} min-w-[9.5rem] flex-1 sm:flex-none`}
                title="Speech-to-text language"
              >
                {STT_LANG_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <MicTranscribeButton
                  language={sttLang}
                  disabled={padLocked}
                  compact
                  onTranscript={(t) => {
                    const chunk = t.trim();
                    if (!chunk) return;
                    setDraft((prev) =>
                      prev.trim() ? `${prev}\n${chunk}` : chunk,
                    );
                  }}
                />
                <FileAttachControl
                  disabled={padLocked}
                  desktopAccept={FILE_INPUT_ACCEPT}
                  title="Attach photo or text"
                  ariaLabel="Attach photo or text"
                  className="min-h-10 rounded-lg border border-[var(--line)] px-2.5 text-xs font-medium text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
                  onFiles={(files) => void onFiles(files)}
                >
                  File
                </FileAttachControl>
                <button
                  type="button"
                  disabled={padLocked}
                  onClick={() => setCameraOpen(true)}
                  className="min-h-10 rounded-lg border border-[var(--teal)]/35 bg-[var(--teal)]/10 px-2.5 text-xs font-semibold text-[var(--teal)] disabled:opacity-40"
                >
                  Camera
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--line)] pt-2">
              <button
                type="button"
                disabled={!draft.trim() || padLocked}
                onClick={() => void runCoach({ manual: true })}
                className="min-h-10 flex-1 rounded-lg bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-40 sm:flex-none sm:min-w-[7.5rem]"
              >
                {busy === "coach" ? "Coaching…" : "Coach"}
              </button>
              <button
                type="button"
                disabled={!draft.trim() || padLocked}
                onClick={() => void structure()}
                className="min-h-10 flex-1 rounded-lg border border-[var(--teal)] px-4 text-sm font-medium text-[var(--teal)] disabled:opacity-40 sm:flex-none"
              >
                {busy === "structure"
                  ? "Structuring…"
                  : structureCtaLabel(writingType, stageKind)}
              </button>
              <button
                type="button"
                disabled={!draft.trim() || padLocked}
                onClick={() => {
                  void (async () => {
                    if (journalId) {
                      await saveJournal(draft);
                      setPadStatus("Saved in journal.");
                      return;
                    }
                    setBusy("save");
                    try {
                      const res = await fetch("/api/journal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          accountId,
                          body: draft,
                          title: title.trim() || draft.split(/\n/)[0]?.slice(0, 48),
                          writingType,
                        }),
                      });
                      const data = (await res.json()) as {
                        item?: { id: string; date?: string };
                        error?: string;
                      };
                      if (!res.ok || !data.item?.id) {
                        throw new Error(data.error || "Save failed");
                      }
                      setJournalId(data.item.id);
                      setJournalDate(data.item.date || null);
                      setWritingType("journal");
                      setPadStatus("Saved in journal.");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Save failed");
                    } finally {
                      setBusy(null);
                    }
                  })();
                }}
                className="min-h-10 flex-1 rounded-lg border border-[var(--line)] px-4 text-sm font-medium text-[var(--ink)] disabled:opacity-40 sm:flex-none"
              >
                {journalSaving || busy === "save"
                  ? "Saving…"
                  : journalId
                    ? "Save journal"
                    : "Save in journal"}
              </button>
            </div>
          </div>

          {(padStatus || liveCoachBusy || busy === "ingest") && (
            <p className="mt-2 text-[11px] text-[var(--teal)]">
              {busy === "ingest" && !padStatus
                ? "Reading…"
                : padStatus || (liveCoachBusy ? "Live coach…" : null)}
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-[var(--coral)]">{error}</p>
          )}
        </div>

        <div className="flex min-h-0 flex-col bg-[var(--surface)] md:bg-transparent">
          <div
            className={`${
              mobileTab === "feedback" ? "flex" : "hidden"
            } flex-1 flex-col border-b border-[var(--line)] bg-[var(--surface)] p-4 md:flex`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
              Feedback
            </p>
            {feedbackBody}
          </div>

          <div
            className={`${
              mobileTab === "stage" ? "flex" : "hidden"
            } flex-col md:flex ${
              stageExpanded || mobileTab === "stage"
                ? "flex-1"
                : "md:flex-none"
            }`}
          >
            <button
              type="button"
              onClick={() => setStageExpanded((v) => !v)}
              className={`hidden items-center justify-between gap-2 border-b border-white/10 bg-[#1a2228] px-4 py-3 text-left text-[#e8e2d8] md:flex ${
                stageExpanded ? "" : ""
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8fb896]">
                Stage ·{" "}
                {stageKind === "music"
                  ? "lyrics & song"
                  : stageKind === "image"
                    ? "image prompt"
                    : "video prompt"}
              </span>
              <span className="text-[11px] text-[#a89f92]">
                {stageExpanded ? "Collapse" : "Expand"}
              </span>
            </button>

            <div
              className={`${
                stageExpanded || mobileTab === "stage"
                  ? "flex"
                  : "hidden md:hidden"
              } flex-1 flex-col bg-[#1a2228] p-4 text-[#e8e2d8]`}
            >
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="ws-stage-style">
              Stage style
            </label>
            <select
              id="ws-stage-style"
              value={
                stageStyles.includes(genre)
                  ? genre
                  : normalizeStageStyle(stageKind, genre)
              }
              onChange={(e) => {
                const next = e.target.value;
                setGenre(next);
                if (!captionTouchedRef.current) {
                  setCaption(styleCaptionSeed(stageKind, next, gender));
                }
              }}
              className="min-h-10 min-w-[9rem] flex-1 rounded-lg border border-white/15 bg-black/30 px-2.5 text-xs font-medium text-[#e8e2d8] outline-none focus:border-[#8fb896]"
              title="Style — Structure suggests a default; you can change it"
            >
              {stageStyles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#a89f92]">
              After Structure · change anytime
            </p>
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
            onChange={(e) => {
              captionTouchedRef.current = true;
              setCaption(e.target.value);
            }}
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
                    : `Generate video (~${estimateVideoDurationSec(
                        buildVisualPrompt(lyrics, caption) ||
                          lyrics ||
                          caption ||
                          "scene",
                      )}s)`}
            </button>
          </div>
          {status && <p className="mt-3 text-sm text-[#8fb896]">{status}</p>}
          {error && <p className="mt-2 text-sm text-[#e09a7a]">{error}</p>}
            </div>
          </div>
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
