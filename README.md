# Spark · AI Tutor

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-see%20repo-lightgrey)](https://github.com/zilinli/ryan_learning)

**Spark** is a Socratic AI tutor for international-school students (built around BASIS Grade 4 learner **Ryan**). It guides step by step — it does **not** dump final answers first.

> Live idea: chat · photo your homework · hear replies · draw geometry · remember progress across sessions.

**Repository:** [github.com/zilinli/ryan_learning](https://github.com/zilinli/ryan_learning)

---

## Why Spark

Most chatbots spoil homework. Spark is tuned for **thinking first**:

| Mode | Behavior |
|------|----------|
| Pure recall (e.g. `7×8`) | Confirm briefly + memory tip |
| Medium computation (e.g. `256÷8`) | One scaffold first, then check |
| Conceptual / homework | Hint ladder L0→L3 with **explain-your-reasoning**, second chances, analogies |

Also: **粤语 / Cantonese by default** for Chinese (普通话 only when you pick the Yunxi voice), plus English and Spanish TTS/STT.

---

## Features

- **Socratic chat** — locate → choose → explain why → nudge → second chance on mistakes
- **Homework photos & PDFs** — multi-file upload; quote evidence from the right place first
- **Math & diagrams** — LaTeX (KaTeX), SVG geometry via `draw_geometry`, Mermaid
- **Voice** — neural TTS (read aloud) and STT (speak to type); Auto language switching
- **Learning memory** — topic mastery, streaks, light badges (never interrupt a stuck moment)
- **Tools (silent)** — `web_search`, `fetch_page`, `run_python`, `run_js`, `draw_geometry`
- **History** — searchable chats, photo vault, server sync
- **Code Agent** — vibe-coding mini window for live edits to Spark itself

---

## Code Agent (Vibe Coding)

Spark includes a built-in code agent for modifying the app itself — change colors, layout, features, or fix bugs without leaving the browser.

### Opening

Click **"Code Agent"** in the sidebar header to open the panel. On desktop it slides in from the right; on mobile it appears as a bottom sheet.

### What you can ask

The code agent reads your project files, searches code, makes edits, and runs tests. Example prompts:

- "Make the text bigger"
- "Add a dark orange accent color"
- "Fix the photo button on mobile"
- "Show math steps one by one"
- "Add a new subject filter"

### Window controls

| Control | How |
|---------|-----|
| **Minimize** | Click the **−** (dash) button in the header — panel collapses to a floating 🤖 bubble at bottom-right. Click the bubble to restore. |
| **Close** | Click the **×** button in the header, or press **Escape**. On mobile, tap the backdrop or swipe down. |
| **New session** | Click **+ New** next to the panel title to start fresh. |
| **Full ACC** | Click **↗ ACC** (if running) to open the Agent Chat Console in a separate tab. |

### Diff review & apply

When the agent proposes code changes, it shows a diff block with file name, added (+) and removed (−) line counts. Click **Apply** to accept (requires PIN gate confirmation) or **Cancel** to discard. After applying, a ✓ banner confirms the changes.

### Requirements

- Agent Chat Console must be running on port 3001: `cd agent-chat && npm run dev`
- The code agent uses the same `CURSOR_API_KEY` as the tutor

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | [Next.js](https://nextjs.org/) 16 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS 4, KaTeX, Mermaid, react-markdown |
| Agent | [Cursor SDK](https://cursor.com/) (`@cursor/sdk`) + in-process tool harness |
| Voice | Local STT service + Edge neural TTS via `/api/tts` |
| Tests | Vitest unit tests + `verify:*` end-to-end scripts |

---

## Quick start

### Requirements

- Node.js 20+ (recommended)
- A [Cursor API key](https://cursor.com/dashboard/integrations) (`CURSOR_API_KEY`)
- Optional: local STT service on port `8765` for speech-to-text

### Install & run

```bash
git clone https://github.com/zilinli/ryan_learning.git
cd ryan_learning
cp .env.local.example .env.local   # then edit CURSOR_API_KEY
npm install
npm run prepare-env                # validates / unlocks local env helpers
npm run dev                        # http://127.0.0.1:3000
```

Production:

```bash
npm run build
npm start                          # http://127.0.0.1:3000
```

**Windows:** double-click `start-qizhi.bat` (or `start.bat`). Close the console window to stop.

### Environment

See [`.env.local.example`](./.env.local.example):

| Variable | Required | Purpose |
|----------|----------|---------|
| `CURSOR_API_KEY` | yes | Cursor agent / models |
| `CURSOR_MODEL` | no | Override model id (`auto` by default) |
| `GOOGLE_API_KEY` / `GOOGLE_CSE_ID` | no | Extra web search via Google CSE |

List models available to your key: `GET /api/models`.

---

## Project layout

```
src/
  app/                 # Next.js routes (/api/chat, /api/tts, history, …)
  components/          # TutorShell, Composer, MarkdownMessage, …
  lib/                 # prompts, voices, geometry-svg, learning-memory, harness
tutor-workspace/       # Agent working notes (AGENTS.md)
scripts/               # ensure-env, verify-*, STT helpers
```

Teaching policy lives mainly in:

- [`src/lib/prompts.ts`](./src/lib/prompts.ts) — system prompt / hint ladder
- [`tutor-workspace/AGENTS.md`](./tutor-workspace/AGENTS.md) — agent instructions

---

## Development

```bash
npm test                 # unit tests (Vitest)
npm run lint
npm run verify:all       # unit + history/upload/tts/stt/voice/diagrams/system
```

Individual checks:

```bash
npm run verify:history
npm run verify:upload
npm run verify:tts
npm run verify:stt
npm run verify:voice
npm run verify:diagrams
npm run verify:system
```

Tip: keep `spark-tutor` (or `npm start`) and the STT service running before `verify:all`.

---

## Pedagogy (short)

Spark’s coaching ladder (conceptual work):

1. **L0** — Locate / clarify  
2. **L1** — Interactive choice (no spoilers)  
3. **L1.5** — Ask *why* before marking right/wrong  
4. **L2** — Process nudge  
5. **L2.5** — Wrong answer → second chance (no reveal yet)  
6. **L3** — Stronger scaffold  
7. Full solution — only if the student asks after trying  

Plus: concrete analogies when stuck, writing feedback that never rewrites their sentence, geometry “what would you measure?”, and TTS-friendly plain-word maths beside LaTeX.

---

## Contributing

Issues and PRs are welcome.

1. Fork → branch → keep changes focused  
2. Add/adjust tests when behavior changes  
3. Run `npm test` (and relevant `verify:*` scripts) before opening a PR  
4. Prefer clear commit messages that explain *why*

Please do **not** commit secrets (`.env.local`, API keys, unlocked credential blobs).

---

## Security notes

- Treat `CURSOR_API_KEY` as a secret; never commit it  
- Tutor tools run in a constrained harness (short timeouts, no arbitrary host shell)  
- SVG from the model is sanitized before render  

---

## License

Open source on GitHub: **[zilinli/ryan_learning](https://github.com/zilinli/ryan_learning)**.  
Add a root `LICENSE` file if you want an explicit OSI license for downstream use.

---

## Credits

Built as a personal AI tutor for **Ryan** (BASIS G4). Powered by Cursor’s agent SDK, Next.js, and Edge neural voices.
