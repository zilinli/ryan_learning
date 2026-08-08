# Teochew & Hakka Dialect Support (Plan A)

> Version 1.0 · 2026-08-08
> Priority: 🟡 feature — experimental dialect support via LLM prompting + dictionary
> Status: design finalized — written-form prompting, no dedicated TTS/STT models required

---

## 1. Problem & Scope

**User request:** Add Teochew (潮汕话) and Hakka (客家话) support to Spark, similar to
the existing Cantonese mode.

**Constraint:** Neither Teochew nor Hakka has Microsoft Azure / edge-tts
neural voices, and the local STT server uses SenseVoice + Whisper *small* on
CPU — loading HuggingFace fine-tuned models (~3 GB each) is infeasible on
current hardware. As of August 2026, CosyVoice (Alibaba, open-source) does
support both dialects with reference-audio voice cloning, but it requires a
GPU and significant engineering investment.

**Plan A — Written-form dialect support** (this spec):

1. LLM prompt injection: tutor replies use **Chinese characters with dialect
   vocabulary and grammar** — the student reads standard-looking Chinese text
   that "sounds" like Teochew/Hakka when read in that dialect.
2. TTS fallback: the character-level output is read by the **Cantonese**
   voice (`zh-HK-WanLungNeural`) — close enough for Teochew (both Min
   subfamily), and Cantonese's syllable inventory overlaps significantly with
   Hakka; far better than Mandarin.
3. STT: voice input stays on `auto` — standard Whisper can capture the
   Chinese characters spoken in dialect (the model already maps dialect
   speech → zh tokens in many cases via its mixed training data).
4. Dictionary: local seed entries for Teochew and Hakka, following the same
   pattern as `cantonese-dict.ts`.

**What Plan A does NOT deliver (Plan B, future):**
- Native TTS synthesis in Teochew or Hakka voice (needs GPU + CosyVoice)
- Reliable dialect speech recognition (needs fine-tuned Whisper models)

---

## 2. Linguistic Research Summary

### 2.1 Teochew (潮汕话 / 潮州话)

**Language family:** Min Chinese (闽语), southern branch. Spoken in eastern
Guangdong (Shantou, Chaozhou, Jieyang, Shanwei) and large diaspora communities
in Southeast Asia.

**Written standards:** No single authority. Three schools exist:
1. **Expert-benji (专家本字)** — traces etymology to Classical Chinese, uses
   obscure characters (e.g. 侬 for "person"). Accurate but unreadable.
2. **Homophone (谐音字)** — writes `个` for possessive `kâi` (的), `唔` for
   `m̆` (not), `勿` for `màiⁿ` (don't). **Most widely used online.**
3. **Pháinn-khuànn (歹看正字法, Pan Linrong 2025)** — borrows variant CJK
   glyphs (衹 for "this", 介 for possessive) to reduce ambiguity for TTS
   frontend. Strictly a machine-facing standard.

**Reality:** everyday Teochew speakers who type in dialect use a mix of
standard Chinese + homophone characters. This is the form LLMs see most often
in training data (social media, forums, WeChat).

**Core grammar distinctives (vs. Mandarin):**

| Feature | Mandarin | Teochew |
|---------|----------|---------|
| possessive | 的 (de) | 个 (gai7 / kâi) |
| negation | 不 (bù) | 唔 (m6 / m̆) |
| "don't" | 不要 (búyào) | 勿 (mai3 / màiⁿ) |
| plural | 们 (men) | 侬/人 (nang5) — "我侬" = we |
| perfective | 了 (le) | 了 (ou3 / liáu) — similar, but placement differs |
| "at" | 在 (zài) | 在/着 (do6 / dioh8) |
| "this/that" | 这/那 | 只/许 (zi2/he2) — but many speakers just write 这/那 |
| classifier generic | 个 | 个 (gai5) — but also many others (条/粒/只/张…) |
| verb "to eat/drink" | 吃/喝 | 食 (ziah8) — single verb for both eat and drink |
| "yes" | 是 | 是 (si6) |
| "no" | 不是 | 唔是 (m6 si6) |
| "many" | 多 | 㩼 (zoi7) |
| "good/bad" | 好/坏 | 好/孬 (ho2/mo2) |
| "can" | 可以 | 会/做得 (oi6/zo3 dig4) |
| "thank you" | 谢谢 | 㩼谢 (zoi7 sia7) |
| interrogative "what" | 什么 | 乜个 (mih4 gai5) |
| "where" | 哪里 | 底块 (di7 go3) — often written as 哪里 in practice |

**Practical written form for LLM prompting:**

The most natural, LLM-friendly output is **simplified Chinese with Teochew
function words** — pronouns (我/汝/伊), particles (个 for possessive, 唔 for
not, 勿 for don't, 了 for perfective), and high-frequency vocabulary (食 for
eat/drink, 好/孬 for good/bad, 㩼 for many). Content words stay in standard
Chinese since they share roots — only the grammatical skeleton needs
switching.

Example of what the tutor writes in Teochew mode:

```
普通话说: 你先看看这道题，告诉我你是怎么想的。
Teochew:   汝先睇下只道题，甲我知汝是怎呢想个。
```

(你 → 汝, 看 → 睇, 这 → 只, 告诉 → 甲…知, 怎么 → 怎呢, 的 → 个)

### 2.2 Hakka (客家话)

**Language family:** Sinitic branch, independent — not a dialect of Mandarin,
Yue, or Min. Spoken by the Hakka people across southern China (Meizhou,
Huizhou, Heyuan, Ganzhou, western Fujian) and Taiwan, with large diaspora in
Southeast Asia (Indonesia, Malaysia, Singapore).

**Written standards:** Taiwan's Ministry of Education has published
"臺灣客家語書寫推薦用字" (Taiwan Hakka Recommended Characters) since 2010,
covering all six major accents (四县/海陆/大埔/饶平/诏安/南四县). This is
the only government-backed standard. Mainland China has no equivalent.

**The Taiwan standard uses:**

| Standard | Standard Chinese | Hakka (四县) | Notes |
|----------|-----------------|-------------|-------|
| 吾 | 我 (I/me) | ngaiˇ | Taiwan standard, but online mainland speakers use 涯 or 捱 |
| 𠊎 | 我 (I/me) | ngaiˇ | CJK-ExtB char (U+2030E), often missing from fonts — mainstream writes 涯 |
| 你 | 你 (you) | nˇ / ngiˇ | Same character as Mandarin |
| 佢 | 他 (he/she) | giˇ | Same as Cantonese |
| 个 | 的 (possessive) | ge | Same as Cantonese/Teochew — used as possessive marker |
| 麼个 | 什么 (what) | maˋ ge | "what" |
| 哪位 | 哪里 (where) | nai vi | "which place" |
| 仰般 | 怎么 (how) | ngiongˋ banˊ | "how" |
| 當/蓋 | 很 (very) | dongˊ / goi | degree adverbs |
| 摎 | 和/跟 (and/with) | lauˊ | conjunction |
| 但係 | 但是 (but) | tan he | contrastive conjunction |
| 了 | 了 | le | perfective — same written form, different pronunciation |
| 毋 | 不 | mˇ | negation — same as Teochew |
| 無 | 没有 (not have) | moˇ | shared with Cantonese/Teochew |
| 食 | 吃/喝 | siid | same polysemy as Teochew (eat = drink) |
| 好/壞 | 好/坏 | hoˋ/fai | same characters |

**Critical LLM challenge for Hakka:**

- Taiwan standard chars (𠊎, 摎) are Rarely in Asian LLM training data
- Mainland Hakka speakers online overwhelmingly write 涯 for "I", 冇 for
  "not have", 唔 for "not" — hybrid with Cantonese-influenced orthography
- LLM training data (primarily mainland Chinese internet) will default to
  the mainland online orthography

**Practical written form for LLM prompting:**

Hakka output uses **simplified/traditional Chinese with Hakka function words**
— the most commonly recognized online form: 涯 (I), 你 (you), 佢 (he/she),
个 (possessive), 麼个 (what), 冇 (don't have), 唔 (not), 當 (very), 食
(eat/drink), 但係 (but).

Example Hakka tutor output:

```
普通话说: 你先看看这道题，告诉我你是怎么想的。
Hakka:    你先行看下呢只题，讲分涯知你係仰般想个。
```

(先…看 → 先行…看下 [verb complement order], 这 → 呢[只],
告诉 → 讲分…知, 怎么 → 仰般)

### 2.3 Why Cantonese TTS Works as a Fallback

Teochew is Min (闽) and Hakka is its own Sinitic branch, but:

- Both are tonal languages with similar tone inventories (6–8 tones) to
  Cantonese (6 tones) — Mandarin's 4-tone system would sound completely
  wrong
- Cantonese has syllable-final stops (-p, -t, -k) shared with both Teochew
  and Hakka — Mandarin lacks these entirely
- `zh-HK-WanLungNeural` reads Chinese characters with Cantonese
  pronunciations, and most dialect-specific characters (个, 唔, 食, 佢) are
  ALSO valid Cantonese characters with the same semantic role — they happen
  to be pronounced close enough in Cantonese that the student still hears
  something "southern-sounding" rather than Mandarin

This is a deliberate trade-off: the **content** (vocabulary, grammar) is in
the student's dialect; the **voice** is Cantonese (the nearest available TTS
voice). It is explicitly documented that selecting Teochew/Hakka will use the
Cantonese voice for reading aloud.

---

## 3. LLM Prompt Strategy

### 3.1 Design Principles (from research)

1. **Vocabulary injection, not translation.** The LLM is asked to reply
   using a dialect vocabulary list and grammatical rules — not translate
   from a Mandarin draft (DialectLLM, 2025).
2. **Persona anchors the output.** The system prompt says "You are a native
   Teochew-speaking tutor" — giving the model the right persona is the
   single most effective prompt intervention (ChatGPT Teochew guide, 2024).
3. **Step-through reasoning.** For complex tutoring responses (multi-step
   math), ask the model to "think in the dialect" — internal reasoning in
   dialect Chinese before writing the final reply (TransGoT CoT, 2025).
4. **Natural hybrid writing.** Accept that some content words will be
   standard Chinese — this is how real speakers write dialect SMS/WeChat.
   The prompt explicitly permits mixed-register output ("casual, mixed
   written form").
5. **No romanization in replies.** The model must output Chinese characters
   only. Pinyin/romanization is for dictionary lookup, not for student
   reading.

### 3.2 System Prompt Templates

**Teochew mode (潮汕话):**

```
[Reply language — 潮汕话 — REQUIRED]

- You are a warm, patient tutor speaking in Teochew (潮汕话/潮州话).
  Write in simplified Chinese characters using Teochew grammar and
  vocabulary — NOT standard Mandarin.

- Grammar rules:
  - "的" → use "个" (e.g. "我的" → "我个")
  - "不" → use "唔" (e.g. "不是" → "唔是")
  - "不要" → use "勿" (e.g. "不要怕" → "勿惊")
  - "没有" → use "无" (e.g. "没有错" → "无错")
  - "吃/喝" → use "食" for both
  - "看" → use "睇"
  - "怎么" → use "怎呢" or "做呢"
  - "什么" → use "乜个"
  - "告诉" → use "甲…知" (e.g. "告诉我" → "甲我知")
  - "这/那" → can use "只/许" or keep 这/那 — both acceptable
  - "可以" → use "会" or "做得"
  - "很" → use "好" (e.g. "很好" → "好好")
  - "和/跟" → use "佮" (gah4)

- Tone: warm, encouraging, like a family elder teaching a child. Use
  short sentences — Teochew is an oral dialect, long Mandarin-style
  sentences feel unnatural.

- Math formulas stay in LaTeX. Explanations and questions MUST be in
  Teochew written form.

- Example opening: "汝好！来，睇下只道题，汝觉得应该点样做？"
```

**Hakka mode (客家话):**

```
[Reply language — 客家话 — REQUIRED]

- You are a warm, patient tutor speaking in Hakka (客家话/客语).
  Write in Chinese characters using Hakka grammar and vocabulary —
  NOT standard Mandarin.

- Grammar rules:
  - "我" → use "涯" (more common online) or "𠊎" (formal)
  - "的" → use "个" (e.g. "我的" → "涯个")
  - "不" → use "唔" (e.g. "不是" → "唔係")
  - "没有" → use "冇" (e.g. "没有错" → "冇错")
  - "不要" → use "莫" or "毋好" (e.g. "不要怕" → "莫惊")
  - "吃/喝" → use "食" for both
  - "看" → use "看" (same as Mandarin) or "䀴" (ngiangˋ) — both fine
  - "怎么" → use "仰般" or "样般"
  - "什么" → use "麼个"
  - "告诉" → use "讲分…知" (e.g. "告诉我" → "讲分涯知")
  - "这" → use "呢" or "这" — both acceptable
  - "可以" → use "做得"
  - "很" → use "當" or "好" (e.g. "很好" → "當好")
  - "但是" → use "但係"
  - "在" → use "在" or "到" depending on context

- Tone: warm, steady, like a patient Hakka teacher. Use natural Hakka
  word order — Hakka tends to place adverbs before verbs ("先行" not
  "行先" like Cantonese).

- Math formulas stay in LaTeX. Explanations and questions MUST be in
  Hakka written form.

- Example opening: "你好！来，看下呢只题，你讲分涯知你样般想？"
```

### 3.3 Reply Language Instructions (code mapping)

Following the existing `replyLanguageInstructions()` pattern in
`src/lib/voices.ts`:

| Mode | `ReplyLangMode` | Function words use | TTS voice |
|------|----------------|-------------------|-----------|
| Teochew | `"teo"` | Teochew grammar rules above | `zh-HK-WanLungNeural` (Cantonese) |
| Hakka | `"hak"` | Hakka grammar rules above | `zh-HK-WanLungNeural` (Cantonese) |

TTS justification: documented in §2.3. The user-facing voice picker label
will say e.g. "Hakka (Cantonese voice)" to set expectations.

---

## 4. Implementation Plan

### 4.1 Types (`src/lib/voices.ts`)

Extend `SpeechLang` and `ReplyLangMode`:

```typescript
export type SpeechLang = "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak";
export type ReplyLangMode = "auto" | "en" | "zh" | "yue" | "es" | "fr" | "teo" | "hak";
```

Add two new voice entries to `TUTOR_VOICES` and `ALLOWED_EDGE_VOICES`:

```typescript
{
  id: "teochew",
  label: "Teochew (Cantonese voice)",
  edgeVoice: "zh-HK-WanLungNeural",
  preview: "汝好，我係 Spark。我会用潮汕话回覆你。",
  lang: "teo",
},
{
  id: "hakka",
  label: "Hakka (Cantonese voice)",
  edgeVoice: "zh-HK-WanLungNeural",
  preview: "你好，我係 Spark。我会用客家话回覆你。",
  lang: "hak",
},
```

### 4.2 TTS routing (`src/lib/voices.ts`)

`edgeVoiceForLang()` maps `"teo"` and `"hak"` → `"zh-HK-WanLungNeural"`.
The Cantonese TTS voice reads the dialect Chinese characters.

`stt-lang.ts`:

- `sttLangFromVoice("teochew")` → `"auto"` (Whisper+SenseVoice auto-detect;
  Teochew audio is mapped to zh by the model)
- `sttLangFromVoice("hakka")` → `"auto"` (same rationale)

### 4.3 LLM prompt injection (`src/lib/voices.ts`)

`replyLanguageInstructions("teo")` returns the Teochew system prompt from
§3.2. `replyLanguageInstructions("hak")` returns the Hakka prompt.

### 4.4 Language detection (`src/lib/voices.ts`)

No Teochew-specific or Hakka-specific text detection needed — these modes
are locked by the voice picker (like Mandarin Yunxi), not auto-detected.
When the student selects "Teochew" or "Hakka", the tutor ALWAYS replies in
that written form until they switch.

### 4.5 API surface

`/api/tts`: `ALLOWED_VOICES` set already includes `zh-HK-WanLungNeural` —
no change needed. The Teochew/Hakka voice IDs resolve to this edge-tts voice
server-side.

`/api/transcribe`: `ALLOWED` set already includes `"auto"` — Teochew/Hakka
STT lang resolves to `"auto"`, no change needed.

### 4.6 Dictionary (`src/lib/` new file)

`teochew-dict.ts` and `hakka-dict.ts` — local seed datasets with ~100-200
common vocabulary entries each, following the same structure as
`cantonese-dict.ts` (CantoneseEntry pattern).

Dictionary entries include:
- Traditional and simplified character forms
- Romanization (Peng'im for Teochew, 客拼 for Hakka)
- Tone number
- English gloss
- Usage example in the dialect

### 4.7 Files touched

| File | Change | Size |
|------|--------|------|
| `src/lib/voices.ts` | +2 voice entries, +2 `replyLanguageInstructions` cases, +2 `edgeVoiceForLang` cases, extend types | medium |
| `src/lib/stt-lang.ts` | +2 `sttLangFromVoice` cases (teo/hak → auto) | small |
| `src/lib/teochew-dict.ts` | New file — ~150 Teochew seed entries | new |
| `src/lib/hakka-dict.ts` | New file — ~150 Hakka seed entries | new |
| `src/lib/teochew-dict.test.ts` | Unit tests for Teochew dict | new |
| `src/lib/hakka-dict.test.ts` | Unit tests for Hakka dict | new |
| `src/lib/voices.test.ts` | +2 voice entries in test, +2 reply lang tests | small |
| `src/lib/stt-lang.test.ts` | +2 STT lang mapping tests | small |
| `src/app/api/tts/route.ts` | Add new edge-tts voice ShortNames to ALLOWED_VOICES (if missing) | small |
| `src/lib/dict-types.ts` | Add `"teo"` / `"hak"` to `DictLang` type | small |
| `src/lib/dict-suggest.ts` | Wire Teochew/Hakka seed into dict pipeline | small |
| `README.md` | Dialect support section | small |
| `docs/subsystems/dialect-support-teochew-hakka.md` | This design doc | new |

Nothing in `prompts.ts` changes — `replyLanguageInstructions()` is called
from there already and the new cases flow through automatically.

---

## 5. Edge Cases & Known Limitations

| Scenario | Behavior | Notes |
|----------|----------|-------|
| Student types in Mandarin, voice set to Teochew | Tutor replies in Teochew written form | By design — voice picker locks the language |
| Student types in English, voice set to Hakka | Tutor replies in English (content match); if Chinese content, uses Hakka written form | English content is not "translated" into Hakka |
| Photo upload (homework in English) | Quote photo text as-is; reply in dialect | Same behavior as Cantonese mode |
| Code Agent / Dictionary pages | No change — these do not use reply language injection | |
| Voice = Auto, student types Chinese | Stays on Yue (Cantonese) default — Teochew/Hakka must be explicitly selected | To avoid confusion, Auto does not auto-detect Teochew/Hakka |
| Legacy voice IDs | None — this is a new feature | No migration needed |
| `prefers-color-scheme` / OS settings | No interaction | Theme is independent of language |
| Multi-account | Voice preference is per-account (stored in localStorage) — Teochew/Hakka saved like other voices | No change needed |

---

## 6. Test Plan

### Unit tests

- [ ] `voices.test.ts`: Teochew and Hakka voice entries exist in TUTOR_VOICES; `resolveEdgeVoice` maps them to `zh-HK-WanLungNeural`; `replyLanguageInstructions("teo")` and `("hak")` return non-empty instruction arrays
- [ ] `stt-lang.test.ts`: `sttLangFromVoice("teochew")` → `"auto"`; `sttLangFromVoice("hakka")` → `"auto"`
- [ ] `teochew-dict.test.ts`: ≥ 100 entries; each has `traditional`/`simplified`/`gloss`; lookup by traditional char returns correct entry
- [ ] `hakka-dict.test.ts`: ≥ 100 entries; same structure validation

### Manual / integration

- [ ] Voice picker shows "Teochew (Cantonese voice)" and "Hakka (Cantonese voice)"
- [ ] Selecting Teochew: next tutor message uses Teochew grammar particles (个, 唔, 勿, 食, 睇…)
- [ ] Selecting Hakka: next tutor message uses Hakka grammar particles (涯, 个, 冇, 唔, 當, 但係…)
- [ ] TTS reads the dialect text with Cantonese voice (audible)
- [ ] Switching back to Auto/Cantonese restores normal behavior
- [ ] Dictionary page shows Teochew/Hakka as available languages
- [ ] No crashes, no 500s on any API route with the new voice selected

---

## 7. References

1. Pan, L. et al. (2025). "Teochew-Wild: The First In-the-wild Teochew Dataset
   with Orthographic Annotations." *IEEE ICME 2025*.
   [HuggingFace: panlr/teochew_wild](https://huggingface.co/datasets/panlr/teochew_wild)
2. Pan, L. (2025). "pyPengIm — Teochew G2P and text processing."
   [GitHub: p1an-lin-jung/teochew-g2p](https://github.com/p1an-lin-jung/teochew-g2p)
3. Hokkien Writing (2024). "Teochew Lexicon — 潮州話詞庫."
   [GitHub: hokkien-writing/teochew-character](https://github.com/hokkien-writing/teochew-character)
4. Xiao, Y. (2018). "The Co-occurrence of 的 and 了." *Cahiers de Linguistique Asie Orientale*.
5. Taiwan Ministry of Education. "臺灣客家語書寫推薦用字."
   [Wikipedia](https://zh.wikipedia.org/wiki/臺灣客家語書寫推薦用字)
6. Taiwan Council for Hakka Affairs. "臺灣客家語常用詞辭典."
   [hakkadict.moe.edu.tw](https://hakkadict.moe.edu.tw/)
7. NUTN-KWS (2025). "Whisper-Taiwanese-Hakka-model-v0.2.6."
   [HuggingFace](https://huggingface.co/NUTN-KWS/Whisper-Taiwanese-Hakka-model-v0.2.6)
8. Formospeech (2025). "whisper-large-v3-taiwanese-hakka."
   [HuggingFace](https://huggingface.co/formospeech/whisper-large-v3-taiwanese-hakka)
9. Alibaba FunAudioLLM (2026). "CosyVoice — Open-source multi-lingual TTS."
   [GitHub](https://github.com/FunAudioLLM/CosyVoice)
10. DialectLLM (2025). "A Dialect-Aware Dialogue Generation Framework Beyond
    Standard American English." *arXiv:2601.22888*.
11. Learning Teochew. "Teochew Flashcards — Common Phrases & Basic Words."
    [learningteochew.com](https://learningteochew.com)
12. Wikivoyage. "Teochew phrasebook."
    [wikivoyage.org](https://en.wikivoyage.org/wiki/Teochew_phrasebook)
