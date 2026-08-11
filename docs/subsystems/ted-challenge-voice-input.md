# TED Challenge · Voice Input

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipping** · 2026-08-11 (visibility fix)  
> Related: [entertainments.md](entertainments.md) §6.2 · [voice-tts-stt.md](voice-tts-stt.md)

---

## Problem

Studio TED Lab Challenge answers were **text-only**. Long critique / retell prompts are awkward to type on phones; students already use mic elsewhere (Tutor, Dictionary, Writing Studio).

After v1 shipping, mic still felt “missing” on phones: TED Lab forces a dark canvas (`#141210`) while `MicTranscribeButton` used theme tokens (`--surface-muted` ≈ invisible under dark theme) and a **32×32 compact** control.

## Approach

Reuse the shared **`MicTranscribeButton`** (16 kHz WAV → `POST /api/transcribe`) beside the Challenge textarea.

| Decision | Choice |
|----------|--------|
| STT stack | Existing Bailian / backup pipeline — **not** browser Web Speech API |
| UI | Full-size mic + `tone="onDark"` inside a labeled Speak row (TED palette) |
| Language hint | `auto` default (TED prompts are English; bilingual answers OK) |
| Merge | Append transcript into current answer via `appendVoiceTranscript` |
| After "Check thinking" | Mic disabled while feedback is shown |

```mermaid
flowchart LR
  Mic[MicTranscribeButton onDark] --> WAV[startWavRecorder]
  WAV --> API["/api/transcribe"]
  API --> Append[appendVoiceTranscript]
  Append --> TA[Challenge textarea]
```

## Key files

| File | Role |
|------|------|
| `src/components/TedLab.tsx` | Wire mic + append into Challenge phase |
| `src/components/MicTranscribeButton.tsx` | Shared mic → STT; `tone="onDark"` for forced-dark surfaces |
| `src/lib/entertain/ted-challenge.ts` | `appendVoiceTranscript` helper |
| `src/lib/entertain/ted-challenge.test.ts` | Unit tests TV1–TV3 |

## Risks

| Risk | Mitigation |
|------|------------|
| HTTPS / mic permission | Same hints as MicTranscribeButton (onDark hint colors) |
| Quiet / short clips | Existing silent + size guards |
| Overwrite typed draft | Append only, never replace |
| Invisible on TED dark UI | `tone="onDark"` + min 44px control, not compact |

## Test design

### Unit

| ID | Case |
|----|------|
| TV1 | Empty prev + transcript → transcript |
| TV2 | Non-empty prev + transcript → space-joined append |
| TV3 | Blank / whitespace transcript → prev unchanged |

### Integration / manual

| ID | Case |
|----|------|
| TM1 | Challenge phase: Speak row visible; hold/tap mic → text in textarea |
| TM2 | Type then speak → both retained |
| TM3 | After Check thinking, mic disabled until Next |
| TM4 | Dark theme: mic still high-contrast on TED canvas |

```bash
npm test -- src/lib/entertain/ted-challenge.test.ts
```
