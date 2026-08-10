# AI FAQ (Help & feedback → Ask AI)

> **Subsystem** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipped** · 2026-08-10  
> Related: [faq-feedback-panel.md](faq-feedback-panel.md) · [voice-tts-stt.md](voice-tts-stt.md)

---

## Goal

Inside **Help & feedback**, the default **Ask AI** tab lets students and families ask product questions in **any language** (text, voice, photo, or file). Answers are grounded in **design docs** (`docs/`) and **source code** (`src/`) via a **read-only** Cursor agent — no edits, no commit, no deploy.

---

## UX

| Element | Behavior |
|---------|----------|
| Tabs | **Ask AI** (default) · FAQ · Suggest |
| Composer | Textarea + compact mic (STT) + Upload + Camera + Ask |
| Answer language | Auto (match question) or lock EN / 中文 / 粤 / Melayu / ES / FR / 闽 / 客 / 沪 |
| Voice | Same `/api/transcribe` pipeline as Dictionary; STT hint follows answer-language when not Auto |
| Attachments | Images + PDF/text (shared `filesToAttachments` / `CameraCapture`) |
| Thread | User / Spark Help bubbles; streamed answer; Stop cancels in-flight |
| Panel chrome | Wider slide-over (~460px); mobile sheet up to ~92vh |

Suggestion chips seed common questions (voice, Listen, Malay STT, privacy).

---

## Backend

`POST /api/faq-ai`

```json
{
  "question": "…",
  "replyLang": "auto",
  "attachments": [ /* optional images/files */ ]
}
```

SSE events: `status` · `delta` · `done` · `hb` · `error`.

| Piece | Role |
|-------|------|
| `FAQ_AI_SYS` / `buildFaqAiUserPrompt` | Read-only mission + multilingual reply instruction |
| `createFaqAiTools()` | Only `read_file`, `search_code`, `list_files` |
| Agent name | Spark Help |

Starting docs for the agent: `docs/DESIGN.md`, `docs/subsystems/*`, README, then `src/` to confirm behavior.

---

## Key files

| File | Role |
|------|------|
| `src/lib/faq-ai.ts` | System + user prompt helpers |
| `src/lib/console-harness.ts` | `createFaqAiTools()` |
| `src/app/api/faq-ai/route.ts` | SSE route |
| `src/components/FaqAskPanel.tsx` | Ask UI |
| `src/components/FeedbackPanel.tsx` | 3-tab shell |
| `src/components/MicTranscribeButton.tsx` | `compact` prop for embedded composers |

---

## Tests

| ID | Case |
|----|------|
| FAQ-AI-1 | Sys prompt requires read-only + docs grounding |
| FAQ-AI-2 | `createFaqAiTools` exposes only read tools |
| FAQ-AI-3 | `normalizeFaqReplyLang` / multilingual user prompt |
| FAQ-AI-4 | Manual: Ask in Malay/Chinese with photo → sensible answer |

---

## Out of scope

- Writing code or filing GitHub issues from Ask AI (use **Suggest**)
- Tutoring homework (main chat) — Ask AI is product help only
