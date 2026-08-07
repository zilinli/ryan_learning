"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  searchSpanish,
  type SpanishDictEntry,
  type SpanishSense,
} from "@/lib/spanish-dict";

function genderLabel(g?: SpanishSense["gender"]): string | null {
  if (g === "m") return "m.";
  if (g === "f") return "f.";
  if (g === "n") return "n.";
  if (g === "mf") return "m./f.";
  return null;
}

function numberLabel(n?: SpanishSense["number"]): string | null {
  if (n === "sg") return "sg.";
  if (n === "pl") return "pl.";
  return null;
}

function SenseCard({ sense }: { sense: SpanishSense }) {
  const tags = [genderLabel(sense.gender), numberLabel(sense.number)].filter(
    Boolean,
  );
  return (
    <li className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 dark:bg-[var(--surface-muted)]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          {sense.es}
        </span>
        {sense.pronunciation ? (
          <span className="text-sm text-[var(--ink-muted)]">
            /{sense.pronunciation}/
          </span>
        ) : null}
        <span className="text-xs uppercase tracking-wide text-[var(--teal)]">
          {sense.pos}
          {tags.length ? ` · ${tags.join(" ")}` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-[var(--ink)]">{sense.gloss}</p>
      {sense.example ? (
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          <span className="text-[var(--ink)]">{sense.example.es}</span>
          <span className="mx-1.5 opacity-50">·</span>
          {sense.example.en}
        </p>
      ) : null}
      {sense.note ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--coral)]">
          {sense.note}
        </p>
      ) : null}
    </li>
  );
}

function EntryBlock({ entry }: { entry: SpanishDictEntry }) {
  return (
    <article className="animate-fade-up space-y-3">
      <header>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          {entry.en}
        </h2>
        {entry.aliases?.length ? (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            also: {entry.aliases.join(", ")}
          </p>
        ) : null}
      </header>
      <ul className="space-y-2.5">
        {entry.senses.map((sense) => (
          <SenseCard key={`${sense.es}-${sense.gloss}`} sense={sense} />
        ))}
      </ul>
    </article>
  );
}

export function SpanishDict() {
  const [query, setQuery] = useState("the");
  const results = useMemo(() => searchSpanish(query), [query]);

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg px-6 py-10">
        <div className="animate-fade-up">
          <Link
            href="/"
            className="text-sm text-[var(--ink-muted)] transition hover:text-[var(--teal)]"
          >
            ← Back to tutor
          </Link>
          <p className="mt-4 font-[family-name:var(--font-display)] text-5xl text-[var(--ink)]">
            Diccionario
          </p>
          <p className="mt-3 text-[var(--ink-muted)] leading-relaxed">
            English → Español for Grade 4. Start with{" "}
            <button
              type="button"
              onClick={() => setQuery("the")}
              className="font-medium text-[var(--teal)] underline-offset-2 hover:underline"
            >
              the
            </button>{" "}
            (el / la / los / las).
          </p>
        </div>

        <div className="mt-8 animate-fade-up-delay">
          <label className="block text-sm text-[var(--ink-muted)]">
            Look up a word
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. the, hello, gracias…"
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-[var(--surface-muted)]"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {["the", "a", "hello", "thank you", "water", "book"].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setQuery(w)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  query.trim().toLowerCase() === w
                    ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                    : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] hover:bg-[var(--mist)] dark:bg-[var(--surface-muted)]"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 space-y-10">
          {results.length === 0 ? (
            <p className="text-[var(--ink-muted)]">
              No match yet — try another English or Spanish word.
            </p>
          ) : (
            results.map((entry) => <EntryBlock key={entry.en} entry={entry} />)
          )}
        </div>
      </div>
    </div>
  );
}
