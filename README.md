# Spark · AI Tutor

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-see%20repo-lightgrey)](https://github.com/zilinli/ryan_learning)

**Spark** is a Socratic AI tutor for international-school students (K-12, grade-agnostic). Built around BASIS Grade 4 learner **Ryan** as the default account, with multi-account support for siblings and classrooms. It guides step by step — it does **not** dump final answers first.

> Live idea: chat · photo your homework · hear replies · draw geometry · remember progress across sessions · switch accounts in one tap.

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
- **Multi-account** — per-account data isolation: each student gets their own chat history, learning progress, and voice preferences. Default = Ryan. Siblings and classmates stay separate.
- **Tools (silent)** — `web_search`, `fetch_page`, `run_python`, `run_js`, `draw_geometry`
- **History** — searchable chats, photo vault, server sync
- **Code Agent** — vibe-coding panel for live edits to Spark itself, with multi-modal input (images, PDFs, voice, zh/en switch), auto-git pipeline (test gate → commit → push), parent PIN gate

### Dictionary / Translation (`/dict`)

Word lookup **and** AI sentence/photo translation in one page:

**Word (dictionary)**
- **Languages** — English · Español · Français · 中文 (Mandarin) · 粵語 (Cantonese)
- **Sources** — Merriam-Webster School Dictionary + Spanish-English (when API keys configured), Free Dictionary / local seeds / translate fallback, local Cantonese dataset (開放粵語字典, CC-BY)
- **Voice input** — Hold/tap mic (same 16 kHz WAV + `/api/transcribe` pipeline as the main tutor; language follows the selected dict pill)
- **Text-to-speech** — 🔊 beside each headword (edge-tts)
- **Caching** — 24-hour server-side cache; cross-language glosses on results

**Sentence (AI translation)**
- Full sentences / paragraphs via Cursor Agent (LLM)
- **Photo upload & camera** — OCR + translate worksheets, signs, screenshots (up to 3 images)
- From / To language pickers (including Auto-detect → EN/ES/FR/中文/粵語)
- Learner-friendly notes + speak the translation aloud

Open from the sidebar link **Dictionary / Translation**, or go to `/dict`.

---

## Code Agent

Spark includes a built-in code agent for modifying the app itself — change colors, layout, features, or fix bugs without leaving the browser.

### Opening

Click **"Code Agent"** in the sidebar header to open the mini panel. On desktop it slides in from the right; on mobile it appears as a bottom sheet. A full-page console is also available at `/console`.

### Multi-Modal Input

Beyond text, the code agent accepts:

| Input | How |
|-------|-----|
| 📎 **File upload** | Click the paperclip — supports images (jpg/png/gif/webp), PDFs, text files (txt/md/csv/json/log), and code files (ts/tsx/js/jsx/py). Up to 9 attachments. |
| 📷 **Camera** | Click the camera to open a live viewfinder — snap homework pages, flip cameras, or pick from album. Uses the same `CameraCapture` modal as the main chat. |
| 🎤 **Voice** | Tap the mic to record → automatic STT transcription in the input box |
| zh/en | Toggle voice language between Chinese and English |

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
| **Full ACC** | Click **↗ ACC** (if running) to open the Agent Chat Console in a separate tab on port 3001. |

### Diff review & apply

When the agent proposes code changes, it shows a diff block with file name, added (+) and removed (−) line counts. Click **Apply** to accept (requires PIN gate confirmation) or **Cancel** to discard. After applying, a ✓ banner confirms the changes.

### Auto-Git Pipeline

After each successful agent session, the system runs a test gate and automatically commits + pushes to the `develop` branch on GitHub. A commit badge (SHA + test result) appears at the end of the agent's response.

### Agent Chat Console (port 3001)

A standalone ACC is available at `http://localhost:3001` with the same multi-modal features, plus:

- **File tree explorer** — browse the project filesystem
- **Full chat thread** — persistent session history
- **Auto-git integration** — test → commit → push with real-time status

The mini panel and full `/console` page use the same `/api/console/chat` backend and work without the ACC on port 3001.

---

## Accounts 👤

Spark supports multiple students on a single device — siblings, classmates, or a family tablet shared by 2–3 kids. Each account's data is fully isolated.

**A prominent avatar button in the top-right corner** shows who's currently active. Tap it to switch students instantly — no login, no fuss. Follows the same pattern as Khan Academy Kids and ABCmouse.

### Switching

```
 Tap [👤 Ryan ▾]  →  Pick student  →  Done
```

1. Tap the **avatar pill** in the top-right header (shows name + colored circle)
2. Pick the target account from the dropdown — a **checkmark** shows who's active
3. Spark reloads that student's chat history, skills, and progress instantly
4. "Manage accounts" at the bottom opens the full account page (PIN-gated)

### Account model

| Property | Behavior |
|----------|----------|
| **Default account** | **Ryan** (BASIS G4) — always present, cannot be deleted |
| **New accounts** | Each starts fresh with grade-appropriate defaults (G1–G12) |
| **Data isolation** | Chat history, learning memory (BKT), engagement streaks, and voice preferences are per-account |
| **Shared settings** | Dark mode and parent PIN are device-wide (same for every account) |
| **Switching** | Tap the account avatar in the header — instant switch, no login required |
| **Creation gate** | Adding, editing, or deleting accounts requires the parent PIN |
| **Account limit** | Up to 6 accounts per device |

Design: **[docs/subsystems/multi-tenant-isolation.md](docs/subsystems/multi-tenant-isolation.md)** — includes header layout spec, industry design references (Khan Academy Kids, ABCmouse, shadcn/ui, Duolingo).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | [Next.js](https://nextjs.org/) 16 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS 4, KaTeX, Mermaid, react-markdown |
| Agent | [Cursor SDK](https://cursor.com/) (`@cursor/sdk`) + in-process tool harness |
| Voice | Local STT service (Whisper + SenseVoice) + Edge neural TTS via `/api/tts` |
| Storage | localStorage (per-account namespaced), IndexedDB, server-side JSON files (history, media, learning memory) |
| Ops | systemd service supervision (`spark-tutor`, `spark-stt`, `spark-acc`), health-check gating, auto-git pipeline |
| Tests | Vitest unit tests + `verify:*` end-to-end scripts |

---

## Quick start

### Requirements

- Node.js 20+ (recommended)
- A [Cursor API key](https://cursor.com/dashboard/integrations) (`CURSOR_API_KEY`)
- Optional: local STT service on port `8765` for speech-to-text
- Optional: `pdftotext` (poppler-utils) for PDF text extraction

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
| `SPARK_USE_SYSTEMD` | no | Use systemd service management (1=enabled, 0=direct) |

List models available to your key: `GET /api/models`.

---

## Project layout

```
├── src/
│   ├── app/                        # Next.js routes (/api/chat, /api/tts, /api/console/chat, …)
│   │   └── api/
│   │       ├── chat/               # Tutor chat (Socratic)
│   │       ├── console/chat/       # Code Agent chat
│   │       ├── transcribe/         # Speech-to-text
│   │       ├── tts/                # Text-to-speech
│   │       ├── media/              # Photo vault / homework images
│   │       └── history/            # Chat history
│   ├── components/                 # TutorShell, Composer, VoiceControls, CodeAgentPanel, …
│   └── lib/                        # prompts, voices, BKT, learning-memory, harness, stt-lang, extract-files, file-payload, attachments, …
├── agent-chat/                     # Standalone Agent Chat Console (Next.js, port 3001)
│   ├── public/index.html           # Vanilla JS SPA frontend
│   └── src/
│       ├── app/api/                # chat, workspace, transcribe, setup
│       └── lib/                    # agent, git-ops, attachments, prompts, stt
├── tutor-workspace/                # Agent working notes (AGENTS.md)
├── scripts/                        # ensure-env, health-check, restart-services, verify-*, STT server
├── data/                           # Runtime data (conversations, media, learning-memory.json)
└── docs/                           # Design docs, subsystem specs, TODO
```

Teaching policy lives mainly in:

- [`src/lib/prompts.ts`](./src/lib/prompts.ts) — system prompt / hint ladder
- [`tutor-workspace/AGENTS.md`](./tutor-workspace/AGENTS.md) — agent instructions

---

## Service Management (systemd)

Three systemd units supervise the services:

| Unit | Port | Purpose |
|------|------|---------|
| `spark-tutor` | 3000 | Main Spark AI Tutor (Next.js) |
| `spark-stt` | 8765 | Local speech-to-text (Whisper + SenseVoice) |
| `spark-acc` | 3001 | Agent Chat Console (Next.js dev) |

### Health checks & restart

```bash
# Check all services
node scripts/health-check.mjs

# Ordered restart with health gate (wait each → verify → next)
bash scripts/restart-services.sh full

# Check a specific service
node scripts/health-check.mjs --service=spark
node scripts/health-check.mjs --service=stt
node scripts/health-check.mjs --service=acc
```

The restart script stops services in reverse dependency order, then starts and health-verifies each one before starting the next. STT gets up to 180s for model loading on first boot.

---

## Development

```bash
npm test                 # unit tests (Vitest)
npm run lint
npm run verify:all       # unit + history/upload/tts/stt/voice/diagrams/system/sse/file-locking
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
npm run verify:sse
npm run verify:file-locking
npm run verify:restart        # full service restart integration test
npm run verify:reliability    # test + sse + file-locking
```

Tip: keep `spark-tutor` (or `npm start`) and the STT service running before `verify:all`.

---

## Pedagogy (short)

Spark's coaching ladder (conceptual work):

1. **L0** — Locate / clarify
2. **L1** — Interactive choice (no spoilers)
3. **L1.5** — Ask *why* before marking right/wrong
4. **L2** — Process nudge
5. **L2.5** — Wrong answer → second chance (no reveal yet)
6. **L3** — Stronger scaffold
7. Full solution — only if the student asks after trying

Plus: concrete analogies when stuck, writing feedback that never rewrites their sentence, geometry "what would you measure?", and TTS-friendly plain-word maths beside LaTeX.

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
- Code Agent changes require a **parent PIN gate** before applying edits
- Account creation and deletion are PIN-gated; switching between accounts is PIN-free
- Per-account data isolation via localStorage namespace prefixes (`spark.{accountId}.{module}`)
- Atomic file writes (`tmp+rename`) prevent corruption during concurrent agent sessions

---

## License

Open source on GitHub: **[zilinli/ryan_learning](https://github.com/zilinli/ryan_learning)**.
Add a root `LICENSE` file if you want an explicit OSI license for downstream use.

---

## Credits

Built as a personal AI tutor for **Ryan** (BASIS G4), with grade-agnostic support (G1–G12) and multi-account isolation. Powered by Cursor's agent SDK, Next.js, and Edge neural voices.
