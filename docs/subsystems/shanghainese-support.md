# Shanghainese (上海话 · sha) Language Support

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)
> Status: **design complete** · 2026-08-10
> Pattern reused from: [Malay (`ms`) support](malay-language-support.md) + [Hokkien (`teo`) TTS/STT](dialect-cloud-tts-stt-correct.md)
> Downstream: [TODO.md](../TODO.md)

---

## 1. Goal

Add Shanghainese (上海话, code `sha`) as a fully wired dialect — voice input via Bailian Fun-ASR, TTS via edge-tts Cantonese fallback (no Shanghainese TTS voice on any commercial API as of 2026-08), Shanghainese-to-Mandarin character normalisation in TTS preprocessing.

---

## 2. TTS design

### 2.1 No Shanghainese TTS voice exists commercially

| Service | Shanghainese TTS? | Notes |
|---|---|---|
| Alibaba CosyVoice / DashScope | ❌ No Shanghainese voice listed | `longanmin_v3` is Minnan, not Wu |
| iFlytek | ❌ No Shanghainese listed | |
| Azure Edge TTS | ❌ `zh-CN`/`zh-HK`/`zh-TW` only | |
| Baidu | ❌ No public API | |

**Decision: Use Cantonese `zh-HK-WanLungNeural` as TTS fallback + Shanghainese→Mandarin character normalisation** (same pattern as Hokkien `normalizeForTTS`).

### 2.2 TTS routing

```
tts-provider.ts: lang === "sha"
  → No Bailian/iFlytek Shanghainese voice
  → Fallback: edgeVoiceForLang("sha") → "zh-HK-WanLungNeural"
```

### 2.3 TTS text normalisation

Add `sha` to `normalizeForTTS()` in `tts-text.ts`. Map Shanghainese-specific characters to Cantonese/Mandarin equivalents:

| Shanghainese | Normalisation | Rationale |
|---|---|---|
| 侬 (you) | 你 | Cantonese pronounces 侬 correctly; keep as is but ensure Cantonese TTS handles it |
| 伊 (he/she) | 他/她 | Context-dependent; initially keep as 伊 |
| 阿拉 (we) | 我们 | Cantonese pronounces 阿拉 awkwardly; replace |
| 弗/勿 (not) | 不 | 勿 is shared with Cantonese; keep |
| 个 (的/possessive) | 的 | Context-dependent; leave for Cantonese |
| 勒 (at/ing 了) | 了 | 勒 is not well mapped; keep for now |

Initial conservative approach: keep most character mappings from `teo` without change (汝→你, 涯→我, 勿→不, 冇→没有). Add Shanghainese-specific 阿拉→我们 and 侬→你 if Cantonese TTS reads them poorly.

---

## 3. STT design

### 3.1 Bailian primary

```
bailianAsrLanguageHint("sha") → "zh"  # Shanghainese = Wu Chinese; Bailian auto-detect
```

Bailian Fun-ASR's `auto` language mode should detect Chinese content from Shanghainese speech. If quality is poor, `STT_ENGINE_ORDER_SHA` can be configured to try iFlytek.

### 3.2 Engine order

```
DEFAULT_ORDER["sha"] = ["bailian", "iflytek", "local"]
```

Add `"sha"` to `MULTI_ENGINE_LANGS` in `stt-engine-order.ts`.

### 3.3 Local fallback

`stt-lang.ts`: `sttLangFromVoice("shanghainese") → "zh"`, `sttLangFromDictLang("sha") → "zh"`.

---

## 4. Full integration checklist

### 4.1 Type surface

| File | Change |
|---|---|
| `voices.ts` | `SpeechLang` += `"sha"`; `TutorVoiceId` += `"shanghainese"`; `ReplyLangMode` += `"sha"`; add `TUTOR_VOICES.shanghainese` entry (label: `Shanghainese (上海话)` — no engine suffix in UI); `edgeVoiceForLang`: `sha → zh-HK-WanLungNeural` |
| `stt-lang.ts` | `SttLang` += `"sha"`; 3 mapping functions |
| `transcribe/route.ts` | ALLOWED += `"sha"`; aliases: `shanghainese`, `上海话`, `上海`, `wu` |
| `bailian-asr.ts` | `bailianAsrLanguageHint("sha") → "zh"` |
| `stt-engine-order.ts` | `DEFAULT_ORDER["sha"] = ["bailian", "iflytek", "local"]`; `MULTI_ENGINE_LANGS` += `"sha"` |
| `tts-provider.ts` | `if (lang === "sha") return "edge";` — no Bailian/iFlytek TTS for Shanghainese |
| `prompts.ts` | `audienceLine("sha")`, `styleLine("sha")`, `findThisCue("sha")`, `defaultStudentLine("sha")` — Shanghainese reply instructions |
| `dialect-stt-correct.ts` | Add `DialectKind.sha = "sha"` + correction prompt |
| `dict-types.ts` | `DictLang` += `"sha"`; `DICT_LANG_LABELS.sha = "上海話"` |
| `dict-sentence.ts` | `LANG_NAME.sha = "Shanghainese (上海话) — Wu dialect, primary phonetic transcription transcription (Shanghainese romanization), plus simplified characters"` |
| `dict-translate.ts` | `GTX_CODES["sha"] = "zh-CN"` (no Shanghainese Google Translate code); conditional |
| `Dictionary.tsx` | Sample words: `["侬", "吃饭", "侬好", "勿是", "谢谢", "看"]`; source badge: `"shanghainese-local": "滬"` |
| `VoiceControls.tsx` | Dialect notice for `sha` |
| `tts-text.ts` | `normalizeForTTS`: add `lang === "sha"` branch |
| `dict-suggest.ts` | `voiceIdFromDictLang("sha") → "shanghainese"` |

### 4.2 Prompt — replyLanguageInstructions

```ts
if (mode === "sha") {
  return (
    `- Audience: Shanghainese speaker (上海话使用者 · 吴语太湖片).\n` +
    `- Reply: In Shanghainese (吴语/上海话). Use simplified characters with Shanghainese vocabulary and grammar. Key features: 侬 (you), 伊 (he/she/it), 阿拉 (we/us), 弗/勿 (not, before v/vowel), 勒 (了/at/in), 个 (的/possessive, after attribute), 个闲话 (this statement), 迭个 (this), 埃个 (that), 搿个 (this one), 垃海 (at/there), V+脱 (completion, like 掉了), V+好 (finish successfully).\n` +
    `- When the student asks what a word means, explain in Shanghainese first, then Chinese if needed.\n` +
    `- Tone: friendly, patient, conversational. Meet the student at their level. Errors are learning opportunities.\n` +
    `- Never insert Cantonese particles (嘅/咗/哋/喺/乜嘢). Never use Teochew-specific characters (汝/佢/乜个/勿會/唔). Use Shanghainese 侬/伊/阿拉/弗 instead.`
  );
}
```

### 4.3 Dictionary

- `shanghainese-dict.ts` already exists with ~X entries
- Wire into `dict-suggest.ts`
- Google Translate: no Shanghainese code — use `"zh-CN"` as fallback for sentence translation
- Dict page: `DictLang = "sha"`, label `"上海話"`

### 4.4 VoiceControls notice

```
sha: "Shanghainese STT uses Bailian Fun-ASR (fallback: iFlytek → local). TTS uses Cantonese edge voice (no Shanghainese TTS available yet). Your speech may be transcribed with errors — edit before sending."
```

---

## 5. Test plan

### 5.1 Required test updates

| Test file | Additions |
|---|---|
| `voices.test.ts` | `getTutorVoice("shanghainese")` label; `edgeVoiceForLang("sha")` returns `zh-HK-WanLungNeural`; `replyLangFromVoice("shanghainese")` returns `"sha"`; `replyLanguageInstructions("sha")` block |
| `stt-lang.test.ts` | `sttLangFromVoice("shanghainese")`; `sttLangFromDictLang("sha")`; `voiceIdFromDictLang("sha")` |
| `transcribe/route.test.ts` | `"sha"` in ALLOWED; aliases `"shanghainese"`, `"上海话"`, `"上海"`, `"wu"` all map to `"sha"` |
| `bailian-asr.test.ts` | `bailianAsrLanguageHint("sha")` returns `"zh"` |
| `stt-engine-order.test.ts` | `"sha"` default order is `["bailian", "iflytek", "local"]`; in `MULTI_ENGINE_LANGS` |
| `dialect-stt-correct.test.ts` | `DialectKind.sha = "sha"`; prompt contains Shanghainese vocabulary |
| `dict-sentence.test.ts` | `buildSentenceTranslatePrompt({to:"sha"})` includes Shanghainese language name |
| `dict-suggest.test.ts` | `voiceIdFromDictLang("sha")` returns `"shanghainese"` |
| `tts-text.test.ts` | `normalizeForTTS(text, "sha")` character substitutions |
| `tts-provider.test.ts` | `sha` returns provider `"edge"` |

---

## 6. TTS Readback Bug — image/non-text content stripped from speech

### 6.1 Root cause

When AI generates responses with inline image data (e.g., `data:image/gif;base64,...` for animated diagrams), the stripping logic in `cleanTutorSpeechText` and `pullSpeakableFromBuffer` has three gaps:

**Gap A — No bare `data:image/` detection.** If the AI emits a `data:image/` URI without `![]()` markdown wrapper (e.g., raw tool output), no existing regex catches it.

**Gap B — `incompleteDiagramStart` only holds SVG mid-URI, not general `data:image/`.** When streaming, a bare `data:image/gif;base64,...` that arrives mid-chunk won't be held back — it gets split by sentence boundaries and sent to TTS.

**Gap C — The existing `[^)]*` in image regexes is fragile.** While technically `[^)]` DOES match newlines, extremely long base64 strings (hundreds of KB) can cause regex engine performance issues. More robust approach: use `[\s\S]*?` (lazy) and look for the closing marker.

### 6.2 Fix

#### 6.2.1 `cleanTutorSpeechText` — add bare data URI stripping

Add BEFORE the existing `![]()` image stripping:

```ts
// Strip bare data: URIs (no ![]() wrapper — e.g. raw tool output)
t = t.replace(/data:image\/[^\s)]+/gi, " ");
```

#### 6.2.2 `cleanTutorSpeechText` — make ![]() image regex multiline-safe

Replace:
```ts
t = t.replace(/!\[[^\]]*\]\(data:image\/[^)]*\)/gi, " ");
t = t.replace(/!\[[^\]]*\]\(data:image\/[\s\S]*$/gi, " ");
```
With:
```ts
// Strip ![]() data:image references (lazy match for long base64 payloads)
t = t.replace(/!\[[^\]]*\]\(data:image\/[\s\S]*?\)/gi, " ");
```

And:
```ts
t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
t = t.replace(/!\[[^\]]*\]\([^)]*$/g, " ");
```

#### 6.2.3 `incompleteDiagramStart` — catch bare `data:image/` mid-stream

Add a new detection block after the existing SVG mid-URI check:

```ts
// Bare data:image/ mid-stream (not wrapped in ![]())
const bareData = buf.search(/data:image\/(?!svg\+xml)/i);
if (bareData >= 0) {
  // Check it's not inside a complete ![]() wrapper
  const beforeBare = buf.slice(0, bareData);
  const openImg = beforeBare.lastIndexOf("![");
  let covered = false;
  if (openImg >= 0) {
    const check = buf.slice(openImg);
    covered = /^!\[[^\]]*\]\(data:image\/[^)]*\)/i.test(check);
  }
  if (!covered) candidates.push(bareData);
}
```

#### 6.2.4 `maskCompleteDiagrams` — sync with `cleanTutorSpeechText`

Update to match the new `[\s\S]*?` pattern.

#### 6.2.5 `isEncodedJunk` — add `data:image/` prefix

```ts
if (/^data:image\//i.test(t)) return true;
```

### 6.3 Test plan — TTS fix

| Test case | Assert |
|---|---|
| Bare data URI stripped | `cleanTutorSpeechText("你好 data:image/gif;base64,AAAA 世界")` → `"你好世界"` |
| ![]() data:image with long body | `cleanTutorSpeechText("看 ![图](data:image/gif;base64,R0lGODlh...long...)\n 懂了？")` → `"看。懂了？"` |
| Multi-line data URI | `cleanTutorSpeechText("看\n![图](data:image/png;base64,\nAAA\nBBB\n)\n懂了。")` → `"看。懂了。"` |
| isEncodedJunk catches bare data | `isEncodedJunk("data:image/gif;base64,AAA")` → `true` |

---

## 7. Files changed (Shanghainese + TTS fix)

| File | Type | Changes |
|---|---|---|
| `docs/subsystems/shanghainese-support.md` | New | This document |
| `src/lib/tts-text.ts` | Fix | §6.2 fixes |
| `src/lib/tts-text.test.ts` | Test | §6.3 tests |
| `src/lib/voices.ts` | Feature | §4.1 `sha` type + voice |
| `src/lib/voices.test.ts` | Test | §5.1 tests |
| `src/lib/stt-lang.ts` | Feature | §4.1 `sha` STT lang |
| `src/lib/stt-lang.test.ts` | Test | §5.1 tests |
| `src/app/api/transcribe/route.ts` | Feature | §4.1 ALLOWED + aliases |
| `src/app/api/transcribe/route.test.ts` | Test | §5.1 tests |
| `src/lib/bailian-asr.ts` | Feature | §4.1 language hint |
| `src/lib/bailian-asr.test.ts` | Test | §5.1 tests |
| `src/lib/stt-engine-order.ts` | Feature | §4.1 DEFAULT_ORDER + MULTI |
| `src/lib/stt-engine-order.test.ts` | Test | §5.1 tests |
| `src/lib/prompts.ts` | Feature | §4.2 prompt instructions |
| `src/lib/prompts.test.ts` | Test | §5.1 tests |
| `src/lib/dialect-stt-correct.ts` | Feature | §4.1 DiffKind |
| `src/lib/dialect-stt-correct.test.ts` | Test | §5.1 tests |
| `src/lib/dict-types.ts` | Feature | §4.1 DictLang + labels |
| `src/lib/dict-sentence.ts` | Feature | §4.1 LANG_NAME |
| `src/lib/dict-sentence.test.ts` | Test | §5.1 tests |
| `src/lib/dict-translate.ts` | Feature | §4.1 GTX_CODES |
| `src/lib/dict-translate.test.ts` | Test | §5.1 tests |
| `src/lib/dict-suggest.ts` | Feature | §4.1 voiceIdFromDictLang |
| `src/lib/dict-suggest.test.ts` | Test | §5.1 tests |
| `src/components/Dictionary.tsx` | Feature | §4.1 samples + badge |
| `src/components/VoiceControls.tsx` | Feature | §4.4 dialect notice |
| `src/lib/tts-provider.ts` | Feature | §4.1 `sha → edge` |
| `src/lib/tts-provider.test.ts` | Test | §5.1 tests |
| `README.md` | Docs | Add Shanghainese |
| `docs/DESIGN.md` | Docs | Link this doc |
| `docs/TODO.md` | Docs | Add SHA tasks |
