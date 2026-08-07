# Multilingual Dictionary API

## 1.0 Problem

The current Diccionario (`/dict`) is a **static, client-side** English→Spanish dictionary with only 10 hardcoded entries. Most words return "No match." It supports only one language pair and offers no audio, etymologies, or example sentences from authoritative sources.

**User requirements:**
- Authoritative dictionary sources (Merriam-Webster preferred)
- Languages: English, Spanish (Español), French (Français), Chinese 普通话, Cantonese 粵語
- Default lookup: English + Spanish
- Audio pronunciations, example sentences, grammatical info
- Voice input (speech-to-text) — speak a word instead of typing it
- Text-to-speech playback — hear the correct pronunciation of any result headword

## 2.0 API Strategy

We combine **three complementary sources** to cover all target languages:

| Source | Languages | Quota (free) | Strength |
|---|---|---|---|
| **Merriam-Webster Collegiate** | English (definitions) | 1,000/day | Most authoritative; audio, etymology, dates |
| **Merriam-Webster Spanish-English** | ES↔EN (bilingual) | 1,000/day | Bidirectional: ES→EN and EN→ES; Latin-American Spanish |
| **Free Dictionary API** | EN, ES, FR, ZH + all Wiktionary languages | 1,000/hr (no key) | Broad language coverage; IPA, translations, examples |

**Cantonese** is served from a local embedded dataset (`lib/cantonese-dict.ts`) sourced from [Open Cantonese Dictionary (yyzd)](https://github.com/kfcd/yyzd), a CC-BY-3.0 dataset of 6,500+ character entries with Jyutping, definitions, and examples. We ship a curated subset of ~500 common characters.

### 2.1 Fallback Chain

For each request, the `/api/dict` route tries sources in priority order:

```
English word:
  1. Merriam-Webster Collegiate (definitions + audio)
  2. Free Dictionary API (fallback)

Spanish word → English:
  1. Merriam-Webster Spanish-English
  2. Free Dictionary API (fallback)

French word → English:
  1. Free Dictionary API (primary — MW doesn't cover French)

Chinese (Mandarin) word → English:
  1. Free Dictionary API (zh → en)

Cantonese word → English:
  1. Local Cantonese dataset (primary)
  2. Free Dictionary API (zh fallback — limited for Cantonese)
```

### 2.2 Unified Response Schema

Regardless of source, the API always returns:

```typescript
type DictResponse = {
  word: string;
  lang: "en" | "es" | "fr" | "zh" | "yue";
  entries: DictEntry[];
};

type DictEntry = {
  headword: string;           // canonical form
  pronunciation?: string;     // IPA or phonetic
  audioUrl?: string;          // MW audio or external
  partOfSpeech: string;
  definitions: string[];
  examples?: { text: string; translation?: string }[];
  translations?: { lang: string; text: string }[];  // for bilingual lookups
  inflections?: { label: string; form: string }[];
  source: "merriam-webster" | "freedict" | "cantonese-local";
};
```

## 3.0 Architecture

```
┌──────────────────────────────────────────────────┐
│  /dict page (SpanishDict.tsx → DictPage.tsx)     │
│  Language selector: EN | ES | FR | 中文 | 粵語   │
│  Search input → debounced fetch to /api/dict     │
└──────────────────┬───────────────────────────────┘
                   │ GET /api/dict?word=hello&from=en&to=es
                   ▼
┌──────────────────────────────────────────────────┐
│  /api/dict/route.ts                              │
│  1. Check filesystem cache (TTL: 24h)            │
│  2. Route to source(s) based on from/to params   │
│  3. Normalize to unified DictResponse            │
│  4. Write to cache                               │
│  5. Return JSON                                  │
└──────┬─────────────────────┬─────────────────────┘
       │                     │
       ▼                     ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐
│  MW Collegiate│   │ MW Spanish-Eng   │   │  Free Dict API  │
│  + MW Spanish │   │ (dictionaryapi.  │   │  (api.dictionary │
│  (api keys in │   │  com)            │   │  api.dev)        │
│  .env.local)  │   │                  │   │                  │
└──────────────┘   └──────────────────┘   └─────────────────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  dict-cache.ts   │
                    │  data/dict-cache/│
                    │  {lang}/{word}.  │
                    │  json, TTL 24h   │
                    └─────────────────┘
```

## 4.0 Files

| File | Purpose |
|---|---|
| `src/lib/dict-client.ts` | Client-side fetch wrapper (debounce, error handling, localStorage recent-searches) |
| `src/lib/dict-cache.ts` | Server-side file cache: read/write JSON with TTL |
| `src/lib/mw-client.ts` | Merriam-Webster Collegiate + Spanish-English API adapters → unified `DictResponse` |
| `src/lib/freedict-client.ts` | Free Dictionary API adapter → unified `DictResponse` |
| `src/lib/cantonese-dict.ts` | Local Cantonese dataset (~500 common entries) with Jyutping, definitions, search |
| `src/app/api/dict/route.ts` | API route: orchestrates sources, caching, normalization |
| `src/components/Dictionary.tsx` | Refactored Dict page component (replaces `SpanishDict.tsx`) |
| `src/lib/dict-types.ts` | Shared TypeScript types for `DictResponse`, `DictEntry`, etc. |

## 5.0 API Key Configuration

Add to `.env.local` (and `.env.local.example`):

```bash
# Merriam-Webster Dictionary API (register at https://dictionaryapi.com/)
# Free tier: 1,000 queries/day per key, non-commercial use
MERRIAM_WEBSTER_SCHOOL_KEY=your-school-dictionary-key   # English (sd4) — preferred
MERRIAM_WEBSTER_SPANISH_KEY=your-spanish-english-key    # ES↔EN bilingual
# MERRIAM_WEBSTER_COLLEGIATE_KEY=your-collegiate-key    # optional English fallback
```

Keys are optional. When absent, the system falls back to Free Dictionary API / local seeds / translate.
English prefers School Dictionary (`sd4`), then Collegiate if that key is set.

## 6.0 Caching

File-based cache at `data/dict-cache/{source}/{normalized-word}.json`:
- TTL: 24 hours (86400 seconds)
- Cache key: `${source}:${word}` normalized to lowercase, stripped diacritics
- Auto-cleanup: oldest entries evicted when directory exceeds 512 entries per source

## 7.0 UI Design

**Language selector**: Horizontal pills at top of Diccionario page:
`EN` (default, primary) | `ES` | `FR` | `中文` | `粵語`

**Search**: Single input field. User types a word. If language is set to English, it looks up English definitions. If Spanish, it does ES→EN translation. Always shows results in both directions where possible.

**Result card** (per sense/entry):
```
font-display:  hello       /həˈloʊ/   🔊    interjection
Used as a greeting or to begin a telephone conversation.
"Hello, how are you today?"
Translations:  hola (es) · bonjour (fr)
Source: Merriam-Webster
```

**Recent searches**: Stored in localStorage per language, shown as clickable chips below search bar.

**Empty state**: "Type or speak a word to look it up" with sample suggestions from each supported language.

**Voice input** (speech-to-text): Mic button beside the search bar. On tap, records audio via `MediaRecorder`, sends to the existing `/api/transcribe` endpoint, and populates the search box with recognized text. Uses the same STT infrastructure as the main tutor (SenseVoice + faster-whisper).

**Text-to-speech** (read aloud): Each result card has a 🔊 button next to the headword that calls `getSharedSpeechEngine().speak(text)`. This reuses the existing `NeuralSpeechEngine` (edge-tts) from `speech-player.ts`. The first tap unlocks the audio context; subsequent taps play instantly.

## 5.5 Voice Input (Speech-to-Text)

Reuses the existing STT pipeline:

```
Mic button tap → MediaRecorder → Blob → POST /api/transcribe
                                        (language hint from selected lang)
→ text result → populate search box → auto-trigger lookup
```

Languages supported by STT: en, es, fr, zh, yue (auto-detected from selected dictionary language).

## 5.6 Text-to-Speech (Read Aloud)

Reuses the existing `NeuralSpeechEngine` from `speech-player.ts`:

```
🔊 button beside headword → getSharedSpeechEngine().speak(headword, {
  onStart, onEnd, onProgress
}) → edge-tts audio → playback
```

## 8.0 Rate Limiting

- Per-IP rate limit: 30 requests/minute (429 + Retry-After header)
- Server-side only — protects MW quota, avoids abuse
- Client does lightweight debounce (300ms) on input

## 9.0 Testing Strategy

- `src/lib/mw-client.test.ts` — MW response parsing, normalization
- `src/lib/freedict-client.test.ts` — FreeDict response parsing
- `src/lib/cantonese-dict.test.ts` — Jyutping lookup, character search
- `src/lib/dict-cache.test.ts` — Read/write, TTL enforcement, eviction
- `src/components/Dictionary.test.tsx` — UI rendering, language switching
- `scripts/verify-dict.mjs` — E2E: curl /api/dict for each language
