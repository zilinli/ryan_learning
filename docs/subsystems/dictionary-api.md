# Dictionary / Translation API

## 1.0 Overview

`/dict` is **Dictionary / Translation**:

1. **Word mode** — authoritative word lookup (Merriam-Webster School + Spanish, FreeDict / seeds / GTX fallback, local Cantonese).
2. **Sentence mode** — full-sentence / paragraph / **photo** translation via Cursor Agent (LLM).

Sidebar label: **Dictionary / Translation**.

**Languages:** English · Español · Français · 中文 · 粵語

## 2.0 Word lookup sources

| Source | Languages | Quota (free) | Strength |
|---|---|---|---|
| **Merriam-Webster School (`sd4`)** | English | 1,000/day | Learner-friendly definitions + audio |
| **Merriam-Webster Spanish-English** | ES↔EN | 1,000/day | Bidirectional bilingual |
| **Free Dictionary API** | EN (+ spotty ES/FR/ZH) | 1,000/hr | Broad EN coverage |
| **Local seeds + GTX translate** | ES/FR/ZH/Yue | offline / unbounded | Fills FreeDict gaps |
| **Cantonese local** | 粵語 | offline | Jyutping + glosses |

### 2.1 Word fallback chain

```
cache (MW first) → Merriam-Webster → FreeDict → seeds → (non-EN) GTX gloss
→ fuzzy suggest / auto-correct → cross-language enrichment
```

## 3.0 Sentence / photo translation (LLM)

`POST /api/dict/translate`

```json
{
  "text": "optional typed sentence",
  "from": "auto|en|es|fr|zh|yue",
  "to": "en|es|fr|zh|yue",
  "images": [
    { "name": "photo-1.jpg", "mimeType": "image/jpeg", "data": "<base64>" }
  ]
}
```

- Requires Cursor API key (same as tutor).
- Spawns a short-lived **Spark Translator** agent (no tutor tools).
- Photos: model reads visible text (OCR), then translates into `to`.
- Max 3 images; text ≤ 4000 chars.
- Response:

```json
{
  "detectedSourceLang": "es",
  "sourceText": "…",
  "translation": "…",
  "notes": "optional short tip",
  "from": "auto",
  "to": "en"
}
```

### 3.1 UI (Sentence mode)

```
[ Word | Sentence ]   ← segmented control
From [Auto ▾]  ⇅  To [English ▾]
┌ textarea — sentence / paste ─────────────┐
└──────────────────────────────────────────┘
Photos: [Upload] [Camera]   thumbnails ×
[ Translate with AI ]
┌ Source · es ─────────────────────────────┐
│ …                                        │
│ English                         🔊       │
│ … translation (display type)             │
└──────────────────────────────────────────┘
```

Reuses `CameraCapture` + `compressImageDataUrl` from the main tutor photo pipeline.

## 4.0 Key files

| Path | Role |
|---|---|
| `src/components/Dictionary.tsx` | Page shell: Word / Sentence tabs |
| `src/components/SentenceTranslate.tsx` | Sentence + photo UI |
| `src/app/api/dict/route.ts` | Word lookup orchestration |
| `src/app/api/dict/translate/route.ts` | LLM sentence/photo translation |
| `src/lib/dict-sentence.ts` | Prompt + JSON parse |
| `src/lib/mw-client.ts` | Merriam-Webster School + Spanish |
| `src/lib/dict-translate.ts` | Cross-lang gloss enrichment (words) |
| `src/lib/dict-types.ts` | Shared types |

## 5.0 API keys (`.env.local`)

```bash
CURSOR_API_KEY=…                          # required for Sentence mode
MERRIAM_WEBSTER_SCHOOL_KEY=…              # English (sd4)
MERRIAM_WEBSTER_SPANISH_KEY=…             # ES↔EN
# MERRIAM_WEBSTER_COLLEGIATE_KEY=…        # optional EN fallback
```

`scripts/ensure-env.mjs` preserves non-`CURSOR_API_KEY` lines when rewriting `.env.local`.

## 6.0 Caching (word mode)

File cache: `data/dict-cache/{source}/{lang}/{word}.json` · TTL 24h · MW preferred over FreeDict/translate caches.

## 7.0 Word UI notes

- Language pills · debounced search (~450ms) · mic STT · TTS · Did-you-mean · cross-translations panel
- Rate limit: 120/min; seeds / translate still available when limited

## 8.0 Testing

- `src/lib/mw-client.test.ts` — MW parse (incl. School Dict `vis` arrays)
- `src/lib/dict-sentence.test.ts` — prompt + JSON parse
- `src/lib/dict-translate.test.ts` — cross-lang enrichment + GTX fallback
- Live: `GET /api/dict`, `POST /api/dict/translate`
