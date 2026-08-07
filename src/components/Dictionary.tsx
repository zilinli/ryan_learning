"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DictEntry, DictLang, DictPageMode, DictResponse, RecentSearch } from "@/lib/dict-types";
import { DICT_LANG_LABELS } from "@/lib/dict-types";
import { dictLookup, loadRecentSearches, saveRecentSearch } from "@/lib/dict-client";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { sttLangFromDictLang } from "@/lib/stt-lang";
import { SentenceTranslate } from "@/components/SentenceTranslate";
import { MicTranscribeButton } from "@/components/MicTranscribeButton";

const SAMPLE_WORDS: Record<DictLang, string[]> = {
  en: ["hello", "the", "dictionary", "water", "beautiful", "imagination"],
  es: ["hola", "gracias", "agua", "libro", "casa", "bonito"],
  fr: ["bonjour", "merci", "eau", "maison", "livre", "amour"],
  zh: ["你好", "谢谢", "水", "学习", "字典", "美丽"],
  yue: ["我", "你", "係", "好靚", "食飯", "唔該"],
};

// ── Entry card ──

function EntryCard({ entry }: { entry: DictEntry }) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(() => {
    const engine = getSharedSpeechEngine();
    const text = entry.headword;
    if (speaking) {
      engine.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    engine
      .speak(text, {
        onError: () => setSpeaking(false),
      })
      .then(() => setSpeaking(false))
      .catch(() => setSpeaking(false));
  }, [entry.headword, speaking]);

  return (
    <article className="animate-fade-up rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 dark:bg-[var(--surface-muted)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            {entry.headword}
          </h2>
          <button
            type="button"
            onClick={speak}
            className={`rounded-full p-1.5 transition active:scale-90 ${
              speaking
                ? "bg-[var(--teal)] text-white animate-pulse-ring"
                : "bg-[var(--mist)] text-[var(--teal)] hover:bg-[var(--teal)]/20"
            }`}
            aria-label={speaking ? "Stop" : `Pronounce ${entry.headword}`}
          >
            {speaking ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
        </div>
        {entry.pronunciation ? (
          <span className="text-sm text-[var(--ink-muted)]">
            /{entry.pronunciation}/
          </span>
        ) : null}
        <span className="rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
          {entry.partOfSpeech || "—"}
        </span>
        {entry.source ? (
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]/60">
            {entry.source === "merriam-webster"
              ? "MW"
              : entry.source === "freedict"
                ? "FD"
                : entry.source === "translate"
                  ? "TR"
                  : "粵"}
          </span>
        ) : null}
      </div>

      <ul className="mt-4 space-y-3">
        {entry.senses.map((s, i) => (
          <li key={i} className="text-[15px] leading-relaxed">
            <p className="text-[var(--ink)]">{s.definition}</p>
            {s.example ? (
              <p className="mt-1 text-sm text-[var(--ink-muted)] italic">
                &ldquo;{s.example}&rdquo;
                {s.exampleTranslation ? (
                  <span className="not-italic text-[var(--ink-muted)]">
                    {" "}
                    — {s.exampleTranslation}
                  </span>
                ) : null}
              </p>
            ) : null}
            {s.translations?.length ? (
              <p className="mt-1 text-sm text-[var(--teal)]">
                {s.translations.map((t) => `${DICT_LANG_LABELS[t.lang]}: ${t.text}`).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

function CrossTranslationsPanel({
  items,
  queryLang,
}: {
  items: { lang: DictLang; text: string }[];
  queryLang: DictLang;
}) {
  if (!items.length) return null;
  const title =
    queryLang === "en" ? "Translations" : "English";
  return (
    <div className="animate-fade-up rounded-2xl border border-[var(--teal)]/25 bg-[var(--teal)]/6 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--teal)]">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((t) => (
          <li
            key={`${t.lang}:${t.text}`}
            className="flex flex-wrap items-baseline gap-x-2 text-[15px]"
          >
            {queryLang === "en" ? (
              <>
                <span className="min-w-[4.5rem] text-xs font-medium text-[var(--ink-muted)]">
                  {DICT_LANG_LABELS[t.lang]}
                </span>
                <span className="font-medium text-[var(--ink)]">{t.text}</span>
              </>
            ) : (
              <span className="font-medium text-[var(--ink)]">{t.text}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main Dictionary component ──

export function Dictionary() {
  const [mode, setMode] = useState<DictPageMode>("word");
  const [lang, setLang] = useState<DictLang>("en");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecents(loadRecentSearches());
  }, []);

  const doLookup = useCallback(
    async (word: string, l: DictLang) => {
      if (!word.trim()) return;
      setError("");
      setLoading(true);
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        const res = await dictLookup(word.trim(), l, abortRef.current.signal);
        setResults(res);
        if (res && res.entries.length === 0) {
          const hint = res.suggestions?.length
            ? ` Did you mean ${res.suggestions.slice(0, 3).map((s) => `"${s}"`).join(", ")}?`
            : " Try another word.";
          setError(`No results for "${word.trim()}" in ${DICT_LANG_LABELS[l]}.${hint}`);
        } else if (!res) {
          setError("Failed to look up the word. Please try again.");
        }
        setRecents(saveRecentSearch(word.trim(), l));
      } catch {
        // aborted
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const onInputChange = useCallback(
    (val: string) => {
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (val.trim().length >= 2) {
        debounceRef.current = setTimeout(() => doLookup(val, lang), 450);
      } else {
        setResults(null);
        setError("");
      }
    },
    [lang, doLookup],
  );

  const onLangChange = useCallback(
    (l: DictLang) => {
      setLang(l);
      setResults(null);
      setError("");
      if (query.trim().length >= 2) {
        doLookup(query, l);
      }
    },
    [query, doLookup],
  );

  // ── Mic: shared WAV STT (same pipeline as main tutor) ──
  const onMicTranscript = useCallback(
    (text: string) => {
      const word = text.trim();
      if (!word) return;
      setQuery(word);
      void doLookup(word, lang);
    },
    [doLookup, lang],
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const resultEntries = results?.entries ?? [];
  const hasResults = resultEntries.length > 0;

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg px-6 py-10">
        {/* Header */}
        <div className="animate-fade-up">
          <Link
            href="/"
            className="text-sm text-[var(--ink-muted)] transition hover:text-[var(--teal)]"
          >
            ← Back to tutor
          </Link>
          <p className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
            Dictionary<span className="text-[var(--ink-muted)]"> / </span>Translation
          </p>
          <p className="mt-3 text-[var(--ink-muted)] leading-relaxed">
            Look up words, or translate full sentences and photos with AI.
          </p>
        </div>

        {/* Mode: Word | Sentence */}
        <div
          className="mt-6 flex rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-1 dark:bg-[var(--surface-muted)] animate-fade-up-delay"
          role="tablist"
          aria-label="Dictionary or Translation"
        >
          {(
            [
              { id: "word" as const, label: "Word", hint: "Dictionary" },
              { id: "sentence" as const, label: "Sentence", hint: "AI translate" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex flex-1 flex-col items-center rounded-xl px-3 py-2.5 transition ${
                mode === tab.id
                  ? "bg-[var(--teal)] text-white shadow-sm"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="text-sm font-semibold">{tab.label}</span>
              <span
                className={`text-[10px] ${
                  mode === tab.id ? "text-white/80" : "text-[var(--ink-muted)]/70"
                }`}
              >
                {tab.hint}
              </span>
            </button>
          ))}
        </div>

        {mode === "sentence" ? (
          <SentenceTranslate />
        ) : (
          <>
        {/* Language selector */}
        <div className="mt-5 flex flex-wrap gap-2 animate-fade-up-delay">
          {(Object.keys(DICT_LANG_LABELS) as DictLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLangChange(l)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                lang === l
                  ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                  : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--mist)] dark:bg-[var(--surface-muted)]"
              }`}
            >
              {DICT_LANG_LABELS[l]}
            </button>
          ))}
        </div>

        {/* Search bar + Mic button */}
        <div className="mt-5 animate-fade-up-delay">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={`Search in ${DICT_LANG_LABELS[lang]}…`}
                autoFocus
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 pr-10 text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[var(--surface-muted)]"
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    abortRef.current?.abort();
                    abortRef.current = new AbortController();
                    doLookup(query, lang);
                  }
                }}
              />
              {loading ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--teal)]/30 border-t-[var(--teal)]" />
                </div>
              ) : null}
            </div>

            <MicTranscribeButton
              language={sttLangFromDictLang(lang)}
              disabled={loading}
              onTranscript={onMicTranscript}
            />
          </div>
        </div>

        {/* Sample words */}
        <div className="mt-3 flex flex-wrap gap-2 animate-fade-up-delay">
          {SAMPLE_WORDS[lang].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => {
                setQuery(w);
                doLookup(w, lang);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                query.trim().toLowerCase() === w.toLowerCase()
                  ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                  : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--mist)] dark:bg-[var(--surface-muted)]"
              }`}
            >
              {w}
            </button>
          ))}
        </div>

        {/* Recent searches */}
        {recents.length > 0 ? (
          <div className="mt-4 animate-fade-up-delay">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/60">
              Recent
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {recents.slice(0, 10).map((r) => (
                <button
                  key={`${r.lang}:${r.word}`}
                  type="button"
                  onClick={() => {
                    setLang(r.lang as DictLang);
                    setQuery(r.word);
                    doLookup(r.word, r.lang as DictLang);
                  }}
                  className="rounded-full border border-[var(--line)]/60 bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--ink-muted)] hover:bg-[var(--mist)] dark:bg-[var(--surface-muted)]"
                >
                  {r.word}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Results */}
        <div className="mt-8 space-y-4">
          {results?.correctedFrom ? (
            <p className="rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/8 px-3 py-2 text-sm text-[var(--ink)]">
              Showing results for <strong>{results.word}</strong>
              <span className="text-[var(--ink-muted)]">
                {" "}
                (corrected from “{results.correctedFrom}”)
              </span>
            </p>
          ) : null}

          {error && !hasResults ? (
            <div className="space-y-3">
              <p className="text-[var(--ink-muted)]">{error}</p>
              {results?.suggestions && results.suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <span className="w-full text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">
                    Did you mean
                  </span>
                  {results.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setQuery(s);
                        doLookup(s, lang);
                      }}
                      className="rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-3 py-1.5 text-sm font-medium text-[var(--teal)] hover:bg-[var(--teal)]/20"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : hasResults ? (
            <>
              {results?.crossTranslations?.length ? (
                <CrossTranslationsPanel
                  items={results.crossTranslations}
                  queryLang={lang}
                />
              ) : null}
              {resultEntries.map((entry, i) => (
                <EntryCard key={`${entry.headword}-${entry.partOfSpeech}-${i}`} entry={entry} />
              ))}
            </>
          ) : query.trim().length >= 2 && !loading ? (
            <p className="text-[var(--ink-muted)]">
              Enter a word to look up definitions, translations, and pronunciations.
            </p>
          ) : null}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
