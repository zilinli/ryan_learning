"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { MicTranscribeButton } from "@/components/MicTranscribeButton";
import { translateSentence } from "@/lib/dict-client";
import { compressImageDataUrl } from "@/lib/image-process";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { sttLangFromDictLang } from "@/lib/stt-lang";
import type {
  DictLang,
  SentenceTranslateResponse,
  TranslateImagePayload,
  TranslateLang,
} from "@/lib/dict-types";
import { DICT_LANG_LABELS, TRANSLATE_LANG_LABELS } from "@/lib/dict-types";

const MAX_PHOTOS = 3;

const SAMPLE_SENTENCES: Record<DictLang, string> = {
  en: "Could you help me with this homework, please?",
  es: "¿Me puedes ayudar con esta tarea, por favor?",
  fr: "Peux-tu m'aider avec ces devoirs, s'il te plaît ?",
  zh: "你能帮我做这道作业题吗？",
  yue: "你可唔可以幫我做呢份功課？",
};

type PhotoAtt = TranslateImagePayload & { id: string };

export function SentenceTranslate() {
  const [from, setFrom] = useState<TranslateLang>("auto");
  const [to, setTo] = useState<DictLang>("en");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<PhotoAtt[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SentenceTranslateResponse | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      getSharedSpeechEngine().stop();
    };
  }, []);

  const addPhoto = useCallback(
    async (payload: { dataUrl: string; mimeType: string; data: string }) => {
      setPhotos((prev) => {
        if (prev.length >= MAX_PHOTOS) return prev;
        return [
          ...prev,
          {
            id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: `photo-${prev.length + 1}.jpg`,
            mimeType: payload.mimeType,
            data: payload.data,
            dataUrl: payload.dataUrl,
          },
        ];
      });
      setError("");
    },
    [],
  );

  const onFile = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Could not read image"));
          reader.readAsDataURL(file);
        });
        const compressed = await compressImageDataUrl(
          dataUrl,
          file.type || "image/jpeg",
        );
        await addPhoto({
          dataUrl: compressed.dataUrl,
          mimeType: compressed.mimeType,
          data: compressed.data,
        });
      }
    },
    [addPhoto],
  );

  const runTranslate = useCallback(async () => {
    if (!text.trim() && photos.length === 0) {
      setError("Type a sentence or take a photo first.");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const out = await translateSentence(
        {
          text: text.trim() || undefined,
          from,
          to,
          images: photos.map(({ name, mimeType, data }) => ({
            name,
            mimeType,
            data,
          })),
        },
        ac.signal,
      );
      setResult(out);
    } catch (err) {
      if (ac.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [text, photos, from, to]);

  const swapLangs = useCallback(() => {
    if (from === "auto") return;
    const nextFrom = to as TranslateLang;
    const nextTo = from as DictLang;
    setFrom(nextFrom);
    setTo(nextTo);
    if (result?.translation) {
      setText(result.translation);
      setResult(null);
    }
  }, [from, to, result]);

  const speakTranslation = useCallback(() => {
    if (!result?.translation) return;
    const engine = getSharedSpeechEngine();
    if (speaking) {
      engine.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    engine
      .speak(result.translation, {
        onEnd: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      })
      .catch(() => setSpeaking(false));
  }, [result, speaking]);

  return (
    <div className="mt-5 space-y-5 animate-fade-up-delay">
      {/* From / To */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[7.5rem] flex-1">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">
            From
          </span>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value as TranslateLang)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[var(--surface-muted)]"
          >
            {(Object.keys(TRANSLATE_LANG_LABELS) as TranslateLang[]).map((l) => (
              <option key={l} value={l}>
                {TRANSLATE_LANG_LABELS[l]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={swapLangs}
          disabled={from === "auto"}
          title={from === "auto" ? "Pick a source language to swap" : "Swap languages"}
          className="mb-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-2.5 text-[var(--ink-muted)] transition hover:border-[var(--teal)] hover:text-[var(--teal)] disabled:opacity-35 dark:bg-[var(--surface-muted)]"
          aria-label="Swap languages"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 16V4M7 4 3 8M7 4l4 4" />
            <path d="M17 8v12M17 20l4-4M17 20l-4-4" />
          </svg>
        </button>

        <label className="min-w-[7.5rem] flex-1">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">
            To
          </span>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value as DictLang)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[var(--surface-muted)]"
          >
            {(Object.keys(DICT_LANG_LABELS) as DictLang[]).map((l) => (
              <option key={l} value={l}>
                {DICT_LANG_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Text */}
      <div>
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Type or paste a sentence… or snap a photo of text"
            className="min-h-[6.5rem] w-full flex-1 resize-y rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[var(--surface-muted)]"
          />
          <MicTranscribeButton
            language={sttLangFromDictLang(from === "auto" ? to : from)}
            disabled={loading}
            onTranscript={(t) => {
              setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(SAMPLE_SENTENCES) as DictLang[]).slice(0, 3).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setFrom(l);
                setText(SAMPLE_SENTENCES[l]);
                if (to === l) setTo(l === "en" ? "zh" : "en");
              }}
              className="rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)] hover:bg-[var(--mist)] dark:bg-[var(--surface-muted)]"
            >
              Try {DICT_LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Photos */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">
            Photos {photos.length > 0 ? `(${photos.length}/${MAX_PHOTOS})` : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photos.length >= MAX_PHOTOS}
              className="rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--mist)] disabled:opacity-40 dark:bg-[var(--surface-muted)]"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={photos.length >= MAX_PHOTOS}
              className="rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--teal)] transition hover:bg-[var(--teal)]/20 disabled:opacity-40"
            >
              Camera
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files);
            e.target.value = "";
          }}
        />
        {photos.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {photos.map((p) => (
              <li key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.dataUrl}
                  alt={p.name}
                  className="h-20 w-20 rounded-xl object-cover ring-1 ring-[var(--line)]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((x) => x.id !== p.id))
                  }
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] text-white shadow"
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">
            Snap a worksheet, sign, or chat screenshot — the model will read the text and translate it.
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => void runTranslate()}
        disabled={loading || (!text.trim() && photos.length === 0)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3.5 text-[15px] font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] disabled:opacity-45"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Translating…
          </>
        ) : (
          "Translate with AI"
        )}
      </button>

      {error ? (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="animate-fade-up space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 dark:bg-[var(--surface-muted)]">
          {result.sourceText ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">
                Source
                {result.detectedSourceLang
                  ? ` · ${result.detectedSourceLang}`
                  : ""}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink-muted)]">
                {result.sourceText}
              </p>
            </div>
          ) : null}

          <div className="border-t border-[var(--line)]/60 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--teal)]">
                {DICT_LANG_LABELS[result.to]}
              </p>
              <button
                type="button"
                onClick={speakTranslation}
                className={`rounded-full p-1.5 transition ${
                  speaking
                    ? "bg-[var(--teal)] text-white"
                    : "bg-[var(--mist)] text-[var(--teal)] hover:bg-[var(--teal)]/20"
                }`}
                aria-label="Speak translation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap font-[family-name:var(--font-display)] text-2xl leading-snug text-[var(--ink)]">
              {result.translation}
            </p>
          </div>

          {result.notes ? (
            <p className="rounded-xl bg-[var(--mist)]/80 px-3 py-2 text-sm text-[var(--ink-muted)] dark:bg-[var(--surface-muted)]">
              {result.notes}
            </p>
          ) : null}
        </div>
      ) : null}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(p) => {
          void addPhoto(p);
        }}
        capturedCount={photos.length}
      />
    </div>
  );
}
