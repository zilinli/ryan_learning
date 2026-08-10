# Malay (Bahasa Melayu) Language Support

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)
> Status: **proposed** · 2026-08-10
> Pattern reused from: [Cantonese (`yue`) TTS/STT plumbing] + [Spanish/French (`es`/`fr`) reply-language phrase bank]
> Prerequisite: **TEO.0-style model verification spike** (§2) — do before writing any code
> Downstream: [TODO.md](../TODO.md)

---

## 1. Goal

Add Malay as a fully supported tutoring language — voice input, voice output, and Ryan actually *replying* in Malay — at the same quality tier as the existing `es`/`fr`/`yue` languages, not as a degraded/fallback language the way Teochew and Hakka currently are.

---

## 2. Important correction before designing: "reuse Cantonese's way" is half-right

Read through every `"yue"` call site in the codebase (8 files, ~35 occurrences) before designing this, and Cantonese turns out to be **two different things bundled together**, only one of which Malay should copy:

| Cantonese does this... | ...because it's | Malay should copy it? |
|---|---|---|
| `edgeVoice: "zh-HK-WanLungNeural"` in `voices.ts`, `bailianAsrLanguageHint()` returns `"yue"` | A distinct **language/voice code** on both TTS and STT services | ✅ **Yes** — this is the genuinely reusable part, and it's the part you asked about |
| `ChineseDialectPref` (`student-profile.ts:9`), auto-detect switching between `"zh"`/`"yue"` on the *same* detected Chinese input (`voices.ts:334-357`), Cantonese-specific character choices in `prompts.ts` ("睇呢度" vs "找到这里") | Cantonese is a **script/register variant of Chinese** — the whole point of that machinery is deciding *which flavor of Chinese* to reply in when the input is Chinese | ❌ **No** — Malay isn't a variant of anything else in this system; it's a new top-level language |

**The correct template for the reply-language phrase bank (`prompts.ts`) is `es`/`fr`, not `yue`.** Those two already show the exact shape a standalone new language takes: `audienceLine()`, `styleLine()`, `findThisCue()`, `defaultStudentLine()` each get one more `if (mode === "ms") return "...";` branch, no dialect-preference/auto-switch logic involved. Building Malay on the `yue` template would incorrectly wire it into the Chinese-dialect-preference system.

---

## 3. Prerequisite: verify the ASR model actually covers Malay

This is the one place a naive copy-paste of the `yue` pattern would silently fail, and it's worth flagging loudly because it's exactly the shape of mistake that caused the Teochew problem (see [`teochew-stt-remediation.md`](teochew-stt-remediation.md)) — assuming API-level dialect/language coverage without checking which specific model is actually configured.

### 3.1 What's confirmed vs. what needs a spike

Checked Aliyun's current documentation (2026-08-10): Malay (马来语) is listed as a supported language, but **not uniformly across every model in the Fun-ASR/Qwen3-ASR family**:

| Model | Malay coverage per current docs |
|---|---|
| `fun-asr-mtl` (Multi-Lingual variant) | ✅ Explicitly listed |
| `qwen3-asr-flash` (recent snapshots, per current help.aliyun.com listing) | ✅ Explicitly listed (30-language list) |
| An older public writeup of `qwen3-asr-flash` (Sept 2025) | Lists only 11 languages, **Malay not among them** — i.e. coverage expanded over time; snapshot-dependent |
| `fun-asr-flash-2026-06-15` — **this repo's actual configured default** (`ALIYUN_ASR_MODEL` in `bailian-asr.ts:24`) | **Not verified** — docs describe plain `fun-asr-flash` as Chinese-dialect + English focused; the Malay-covering list is documented under the separate `fun-asr-mtl` name |

**Translation: don't assume the currently-configured `fun-asr-flash-2026-06-15` snapshot covers Malay just because "Fun-ASR family supports 30 languages" shows up in search results.** The multilingual coverage claims in Aliyun's docs are attached to `fun-asr-mtl` and to `qwen3-asr-flash`'s *current* snapshot specifically — both already reachable via `loadBailianAsrConfig()`'s existing `fallbackModel` field, but the *primary* model may need an explicit override for `ms`.

### 3.2 Spike (do first, ~30 min)

- [ ] **MS.0** — Send 2-3 short Malay audio clips directly to `fun-asr-flash-2026-06-15` with `asr_options.language = "ms"`. If it returns garbage/empty, that confirms the primary model doesn't cover Malay and the language-to-model routing in §4.3 is required (not optional). If it works, §4.3 can be simplified to just the language hint, no model override.

---

## 4. STT design

### 4.1 Type surface (mirrors `es`/`fr`/`yue`, additive)

```ts
// src/lib/voices.ts
export type SpeechLang = "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak" | "ms";

// src/lib/stt-lang.ts
export type SttLang = "auto" | "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak" | "ms";
```

### 4.2 `/api/transcribe` — allow-list and aliases

```ts
// src/app/api/transcribe/route.ts
const ALLOWED = new Set(["auto", "en", "zh", "yue", "es", "fr", "teo", "hak", "ms"]);

// inside normalizeTranscribeLang's aliases table
ms: "ms",
may: "ms",           // ISO 639-2/B
msa: "ms",            // ISO 639-2/T
malay: "ms",
"ms-my": "ms",
bahasa: "ms",
"bahasa melayu": "ms",
```

### 4.3 `bailian-asr.ts` — language hint + Malay model routing

**Root cause (2026-08-10):** Fun-ASR multimodal calls sent `format`/`sample_rate` only — **no `language_hints`**. Without a hint, Chinese-dialect-biased Fun-ASR often transcribed Malay speech as Mandarin. Qwen3 already had `asr_options.language`, but Malay never reached it when Fun-ASR returned a non-empty Chinese string.

**Fix:**

1. Fun-ASR parameters include `language_hints: [hint]` when known (`ms` / `en` / `es` / …).
2. `bailianAsrModelFor("ms")` defaults primary to `qwen3-asr-flash` (or `ALIYUN_ASR_MTL_MODEL` if set).
3. `bailianAsrScriptMismatch` rejects Han-heavy transcripts when the locked voice is `ms`/`en`/`es`/`fr`, forcing the secondary model / local Whisper.

```ts
export function bailianAsrModelFor(lang: string, config: …): string {
  if (lang === "ms") {
    return process.env.ALIYUN_ASR_MTL_MODEL?.trim()
      || config.fallbackModel
      || "qwen3-asr-flash";
  }
  return config.model;
}
```

### 5.1 Voices — Osman only

Picker keeps a single Malay TTS voice: **Osman** (`ms-MY-OsmanNeural`). Legacy `yasmin` localStorage ids normalize → `osman`.

### 4.4 Local Whisper fallback — already fine, no change needed

`scripts/stt_server.py` runs standard Whisper, which has native Malay support (`ms` is one of Whisper's ~99 trained languages) at reasonable quality for a fallback tier. Step ③ in `route.ts`'s chain (`forwardOnce`) needs **no changes** — it already forwards whatever `language` string it's given straight through.

---

## 5. TTS design

### 5.1 New voice entries (`voices.ts`) — exact `yue` pattern

```ts
export type TutorVoiceId =
  | "auto" | "ava" | "ryan" | "yunxi" | "wanLung"
  | "alvaro" | "jorge" | "henri" | "teochew" | "hakka"
  | "osman" | "yasmin";   // new

// in TUTOR_VOICES[]
{
  id: "osman",
  label: "Osman (Bahasa Melayu)",
  edgeVoice: "ms-MY-OsmanNeural",
  preview: "Hai, saya Spark. Saya akan membantu dalam Bahasa Melayu.",
  lang: "ms",
},
{
  id: "yasmin",
  label: "Yasmin (Bahasa Melayu)",
  edgeVoice: "ms-MY-YasminNeural",
  preview: "Hai, saya Spark. Saya akan membantu dalam Bahasa Melayu.",
  lang: "ms",
},
```

One male + one female voice, matching the existing pattern for every other language (English has Ryan/Ava, Spanish has Alvaro/Jorge) rather than shipping only one option.

### 5.2 `sttLangFromVoice` / `voiceIdFromDictLang` (`stt-lang.ts`)

```ts
case "osman":
case "yasmin":
  return "ms";
```

and reverse mapping in `voiceIdFromDictLang`:

```ts
case "ms":
  return "osman"; // default to male voice; picker lets user choose Yasmin
```

### 5.3 `tts-provider.ts` — confirm it needs zero changes

`ttsProviderForLang()` already returns `{ kind: "edge", voice: edgeVoiceForLang(lang) }` for any language that isn't a dialect (`teo`/`hak` go through the cloned-voice/FormoSpeech path instead). Since Malay is a standard edge-tts language exactly like `es`/`fr`, it falls through to the existing `edge` branch automatically once `edgeVoiceForLang` knows about `"ms"` — **no new `kind` needed**, unlike the dialect voices which needed a dedicated provider branch.

---

## 6. Reply-language design (`prompts.ts`) — mirrors `es`/`fr`, not `yue`

```ts
// ReplyLangMode
export type ReplyLangMode = "auto" | "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak" | "ms";

// audienceLine()
if (mode === "ms") {
  return "Audience: student who wants tutoring mainly in Bahasa Melayu (Malay).";
}

// styleLine()
if (mode === "ms") {
  return "Style: guru yang sabar dan mesra — bersifat Sokratik dan interaktif; pelajar berfikir dahulu; ringkas, sesuai untuk telefon dan suara.";
}

// findThisCue()
if (mode === "ms") return "**Lihat sini**";

// defaultStudentLine()
if (!hasHomework) {
  if (mode === "ms") return "Tolong bantu saya.";
}
if (mode === "ms") return "Tolong lihat kerja rumah saya dan bantu saya langkah demi langkah.";
```

Four small additions, same shape as the existing `es`/`fr` branches — no new function structure needed.

---

## 7. Dictionary/translation feature — optional, P2

`DictLang` (`dict-types.ts:3`) and `dict-translate.ts`'s seed phrase table (`EN_CROSS_TARGETS`, hardcoded `[word, lang, translation]` tuples) currently cover `en/es/fr/zh/yue/teo/hak`. Extending this to Malay is straightforward (same tuple shape) but is a **separate, smaller task** from core tutoring support — the dictionary/flashcard feature is a nice-to-have, not required for Ryan to converse in Malay. Sequence it after §4-6 land, not blocking.

- [ ] **MS.7** *(P2, optional)* — Add `"ms"` to `DictLang`, extend `EN_CROSS_TARGETS`, seed ~15 basic word translations in `dict-translate.ts`

---

## 8. Non-goals

- **Malay dialect variants** (Kelantan-Terengganu, Sabah/Sarawak Malay, Indonesian/Bahasa Indonesia as distinct from Malaysia's Bahasa Melayu) — standard `ms-MY` register only, same scoping discipline as not chasing every Chinese dialect.
- **Jawi script** — Latin/Rumi script only; Jawi is a religious/heritage-script use case out of scope for a math/homework tutor.
- **Voice cloning / family-member Malay voice** — unlike Teochew/Hakka (which needed cloning because no edge-tts voice exists at all), Malay already has two solid stock edge-tts voices; cloning isn't needed to reach acceptable quality.
- **Code-switching detection** (Malay/English/Chinese mixed households, common in Malaysia/Singapore) — real phenomenon, but a distinct feature (closer to the B3 voice-confusable-glossary work) rather than part of core language support. Flag as a fast-follow candidate, not in scope here.

---

## 9. Testing plan

| Layer | Test |
|---|---|
| Unit | `voices.test.ts` — `ttsProviderForLang("ms").kind === "edge"`, `edgeVoiceForLang("ms")` returns a `ms-MY-*` voice |
| Unit | `stt-lang.ts` — `sttLangFromVoice("osman") === "ms"`, `voiceIdFromDictLang("ms") === "osman"` |
| Unit | `bailian-asr.ts` — `bailianAsrLanguageHint("ms") === "ms"`; `bailianAsrModelFor("ms", config)` returns override only when `ALIYUN_ASR_MTL_MODEL` set |
| Integration (manual) | §3.2 spike — real Malay clips through the actually-configured model, before writing MS.1-6 |
| Manual smoke | One full voice round-trip on live: speak Malay → transcript correct → Ryan replies in Malay text → TTS plays back correctly |

---

## 10. Files

| File | Change |
|---|---|
| `src/lib/voices.ts` | `SpeechLang`, `TutorVoiceId`, `ReplyLangMode` types + 2 new `TutorVoice` entries + `edgeVoiceForLang` case |
| `src/lib/stt-lang.ts` | `SttLang` type + `sttLangFromVoice`/`voiceIdFromDictLang` cases |
| `src/app/api/transcribe/route.ts` | `ALLOWED` set + alias table |
| `src/lib/bailian-asr.ts` | `bailianAsrLanguageHint` case + new `bailianAsrModelFor` helper (§4.3) |
| `src/lib/prompts.ts` | `audienceLine`/`styleLine`/`findThisCue`/`defaultStudentLine` cases (§6) |
| `src/lib/dict-types.ts`, `src/lib/dict-translate.ts` | *(P2, optional)* — §7 |
| `src/lib/voices.test.ts`, `src/lib/stt-lang.test.ts` *(new if absent)*, `src/lib/bailian-asr.test.ts` *(new if absent)* | New/extended unit tests |

---

## 11. TODO.md wiring (paste into repo)

```md
## 🇲🇾 Malay Language Support (2026-08)

- [ ] **MS.0** — Spike: verify configured `fun-asr-flash-2026-06-15` covers Malay with real audio; decide if `ALIYUN_ASR_MTL_MODEL` override is needed — see [malay-language-support.md](subsystems/malay-language-support.md) §3
- [ ] **MS.1** — Type surface: `SpeechLang`/`SttLang`/`ReplyLangMode` + transcribe route allow-list/aliases — §4.1-4.2, §6
- [ ] **MS.2** — `voices.ts`: Osman + Yasmin voice entries (edge-tts `ms-MY-*`) — §5.1
- [ ] **MS.3** — `bailian-asr.ts`: language hint + conditional model override — §4.3
- [ ] **MS.4** — `prompts.ts`: audience/style/cue/default-line branches for `ms` — §6
- [ ] **MS.5** — Unit tests (§9)
- [ ] **MS.6** — Manual smoke: full voice round-trip on live — §9
- [ ] **MS.7** *(P2, optional)* — Dictionary/translation entries — §7
```

Add this doc to `DESIGN.md`'s document map.

---

## 12. Changelog

- **2026-08-10** — doc drafted; MS.0 spike not yet run (blocks MS.3's model-override decision, does not block MS.1/MS.2/MS.4 which are model-independent).
