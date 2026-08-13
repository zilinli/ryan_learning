# Chat Quote (引用消息) + Code Agent Deploy Reliability

> Version 1.0 · 2026-08-13
> Related: [code-agent-deploy.md](code-agent-deploy.md), [build-optimization.md](build-optimization.md), [ui-composer.md](ui-composer.md)

---

## Part A — Main chat "quote previous message" feature

### A.1 Problem

On the main chat (`/`), a student often wants to point at a **specific earlier
message** ("that step you explained", "that answer", "my last photo") and ask a
follow-up. Today the only signal the model gets is the generic recent history,
so the query can drift off-focus. The ask: let the user **quote a previous
message**, attach it to a new turn, and have the LLM anchor its reply to the
quoted text.

### A.2 Approach

Reuse the existing turn pipeline instead of inventing a new one:

```
ChatThread (quote button) ──onQuote(msg)──▶ TutorShell (quote state)
        │                                        │
        │                                        ├─▶ Composer (preview chip + include in payload)
        │                                        └─▶ handleSend (store on user msg + send to API)
        │
        ▼
  /api/chat ──▶ buildTutorPrompt([Quoted earlier message] block) ──▶ LLM
```

### A.3 Data model (`src/lib/types.ts`)

```ts
export interface ChatQuote {
  messageId: string;          // id of the quoted message
  author: "user" | "assistant"; // who wrote it
  excerpt: string;            // collapsed plain-text snippet (≤ 160 chars)
  content?: string;           // full clipped text (≤ 2000) — populated on send
  attachments?: ChatAttachmentPayload[]; // re-sent images + files
}
```

- `ChatMessage.quote?: ChatQuote` — rendered as a reply block inside the bubble (minimal: messageId/author/excerpt).
- `ChatRequestBody.quote?: ChatQuote` — sent to `/api/chat` (with full content + attachments so the model sees the quoted media).

### A.4 UI design (reference: WeChat / Telegram quote-reply)

| Surface | Behavior |
|---------|----------|
| Message action row | Add a **`Quote`** button **in the action row under each message** (right where `Listen` / `English` sit on tutor messages; a matching row is added under user messages). Always visible, mobile-first. |
| Composer | When a quote is active, show a **teal reply chip** above the textarea: `Replying to — You/The Answer Book · AI Tutor: “excerpt…”` with an **×** to dismiss. |
| Message bubble | A sent message that has a quote renders a **nested reply block** at the top of its bubble (left teal border, small text) so the reply reads in-context. |
| Prompt | The quote is injected as a dedicated `[Quoted earlier message]` block (snippet + full text + extracted file text + image count); quoted images are re-sent as image blocks so the model anchors on them first. |

### A.5 Key files

| File | Change |
|------|--------|
| `src/lib/types.ts` | `ChatQuote` + `quote?` on `ChatMessage` / `ChatRequestBody` |
| `src/lib/quote.ts` | NEW — `buildQuoteFromMessage`, `quoteAttachmentsToPayload`, `resolveQuoteForSend` |
| `src/lib/quote.test.ts` | NEW — unit tests for the helpers |
| `src/lib/prompts.ts` | `quote` param + `[Quoted earlier message]` block (`formatQuote`) |
| `src/app/api/chat/route.ts` | extract quoted images + file summaries, merge into prompt/images |
| `src/components/ChatThread.tsx` | `onQuote` prop + `QuoteAction` button (Listen row + user row) + reply block render |
| `src/components/Composer.tsx` | `quote` / `onQuoteDismiss` props + reply chip + payload |
| `src/components/TutorShell.tsx` | `quote` state, wire `onQuote` / `quote` / dismiss |
| `src/components/tutor/useTutorSession.ts` | `handleSend` accepts `quote`, resolves full wire quote via `resolveQuoteForSend` |

### A.6 Test design

| ID | Case |
|----|------|
| Q1 | `buildTutorPrompt` with `quote` contains `[Quoted earlier message]` and the excerpt |
| Q2 | `buildTutorPrompt` without `quote` does NOT contain the block (no regression) |
| Q3 | `buildHistoryPreview` unaffected (quote is not history) |
| Q4 | Manual: quote a message → chip appears → send → bubble shows reply block → reply anchored to quoted text |

---

## Part B — Code Agent rebuild / deploy reliability

### B.1 Root cause (observed 2026-08-13)

Host is **4 vCPU / 4 GB RAM**, `free` ≈ **127 MB**, swap fully exhausted. The
biggest controllable memory hogs at idle:

| Process | Mode | RSS |
|---------|------|-----|
| `spark-acc` (agent-chat, port 3001) | `next dev` (systemd) | ~273 MB, **peak 799 MB** |
| `spark-tutor` (port 3000) | `next start` (PM2) | ~330 MB |
| `formospeech-tts` (PM2) | python | ~160 MB |
| `spark-stt` (systemd) | python/Whisper | ~47 MB idle, spikes on load |
| Cursor IDE (remote server) | — | ~2.3 GB (not controllable) |

`scripts/smart-build.mjs` aborts the build when `freemem() < 400 MB`
(`memoryCheck()`), and only frees `formospeech-tts` + the app itself. With
`spark-acc` (`next dev`) still resident, the gate trips and every Code Agent
`deploy_live` returns `ok:false` with `FATAL: Insufficient memory`.

Secondary defect: `deploy_live` invokes `npm run build` with `BUILD_TO = 240000`
(4 min), but `smart-build` can legitimately run **4 attempts × 300 s ≈ 20 min**.
On timeout the `npm` wrapper is killed while the `node smart-build.mjs` child is
orphaned, so the agent sees a "failed" build and may retry — starting a second
concurrent build and OOMing the host.

### B.2 Fix

1. **Free the right memory during build** — `smart-build.mjs` also stops
   `spark-acc` and `spark-stt` (systemd) alongside `formospeech-tts`, and
   restarts them after (success or failure).
2. **Make `deploy_live` build directly + give it headroom** — run
   `node scripts/smart-build.mjs` (no `npm` wrapper, so a timeout SIGTERM lands
   on `smart-build` whose handlers restore `.next`), and raise `BUILD_TO` to
   1,500,000 ms (25 min).

### B.3 Test design

| ID | Case |
|----|------|
| D1 | `createConsoleHarnessTools()` still exposes `deploy_live` (no regression) |
| D2 | `deploy_live` dry-run still returns `dryRun:true` |
| D3 | `smart-build` service stop list includes `spark-acc` + `spark-stt` + `systemctl stop/start` (source assertion) |
| D3b | `deploy_live` runs `node scripts/smart-build.mjs` directly (no npm wrapper) |
| D4 | Manual: run `node scripts/smart-build.mjs` on the host and confirm it passes the memory gate |
