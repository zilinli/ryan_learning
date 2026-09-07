# German (Deutsch) Language Support

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)
> Status: **shipped** · 2026-09-07
> Pattern reused from: [malay-language-support.md](malay-language-support.md) + Spanish/French (`es`/`fr`) reply-language phrase bank
> Downstream: [TODO.md](../TODO.md)

---

## 1. Goal

Add **German (Deutsch)** as a fully supported tutoring language — voice input, voice output, tutor replies in German, dictionary / sentence translation, Writing Pad STT pill, FAQ reply lang — at the same quality tier as `es` / `fr` / `ms`.

---

## 2. Requirements

| ID | Requirement | Acceptance |
|----|-------------|------------|
| DE.R1 | Voice picker includes one German edge-tts voice | Conrad (`de-DE-ConradNeural`) selectable under More |
| DE.R2 | Locked voice forces German tutor replies | `replyLangFromVoice("conrad") === "de"` + German system instructions |
| DE.R3 | Auto TTS detects German text | `detectSpeechLang` returns `"de"` for ß / strong German cues |
| DE.R4 | STT accepts German | `/api/transcribe` allow-list + aliases; Bailian hint `"de"` |
| DE.R5 | Dictionary + sentence translate | `DictLang` += `"de"`; FreeDict `de`; GTX + seed glosses |
| DE.R6 | UI surfaces list German | Writing Studio STT, FAQ reply lang, Feedback FAQ copy, README |
| DE.R7 | No dialect machinery | German is top-level Latin-script language (template = `es`/`fr`, not `yue`) |

### Non-goals

- Austrian / Swiss German as separate codes (standard `de-DE` register only)
- Fraktur / historical orthography
- Voice cloning (stock edge-tts is sufficient)
- Full Entertainments UI i18n pack (optional; hub falls back to EN unless DE pack added)

---

## 3. System design

```
Voice picker (conrad)
    ├─ replyLangFromVoice → "de" → prompts.ts / replyLanguageInstructions
    ├─ sttLangFromVoice → "de" → /api/transcribe → Bailian language_hints=["de"]
    └─ resolveEdgeVoice → de-DE-ConradNeural → /api/tts (edge allow-list)

Auto voice
    └─ detectSpeechLang(text) → "de" when ß / German function words → Conrad TTS
```

| Layer | Code | Notes |
|-------|------|--------|
| Types | `SpeechLang` / `ReplyLangMode` / `SttLang` / `DictLang` / `FaqReplyLang` += `"de"` | Additive |
| Voice | `TutorVoiceId` += `"conrad"`; `edgeVoiceForLang("de")` | Single male voice (Henri/Osman pattern) |
| STT | transcribe aliases `de`/`deu`/`ger`/`german`/`de-de` | Script-mismatch rejects Han when lang=`de` |
| TTS | `/api/tts` allow-list synced from `ALLOWED_EDGE_VOICES` | Fixes missing `ms-MY-*` too |
| Dict | FreeDict `de` + local DE seeds + EN↔DE extras | Translate fallback via GTX |
| Prompts | audience / style / cue / default-line + instruction block | Same shape as `fr` |

---

## 4. Files

| File | Change |
|------|--------|
| `src/lib/voices.ts` | types, Conrad entry, detect, edge map, reply instructions |
| `src/lib/stt-lang.ts` | SttLang + voice/dict mappings |
| `src/lib/prompts.ts` | phrase bank + replyLanguage allow-list |
| `src/lib/bailian-asr.ts` | hint + script-mismatch |
| `src/app/api/transcribe/route.ts` | ALLOWED + aliases |
| `src/app/api/tts/route.ts` | allow-list ← `ALLOWED_EDGE_VOICES` |
| `src/lib/dict-types.ts`, `dict-sentence.ts`, `dict-translate.ts`, `local-seeds.ts`, `freedict-client.ts` | DE dictionary path |
| `src/app/api/dict/route.ts` | FreeDict branch for `de` |
| UI: WritingStudio, FaqAskPanel, FeedbackPanel, entertainments (optional DE) | pills / copy |
| Tests + README + DESIGN.md + TODO.md | coverage & docs |

---

## 5. Testing

| Layer | Cases |
|-------|--------|
| Unit | Conrad metadata; `edgeVoiceForLang("de")`; detect ß/Hallo; STT maps; Bailian hint; dict labels |
| Unit | `replyLanguageInstructions("de")` contains Deutsch/REQUIRED |
| Manual smoke | Pick Conrad → speak German → transcript → reply in German → Listen TTS |

---

## 6. Changelog

- **2026-09-07** — design + implementation shipped (Conrad / `de`).
