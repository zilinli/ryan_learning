# Spark · AI Tutor

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

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

Also: **粤语 / Cantonese by default** for Chinese (普通话 only when you pick the Yunxi voice), plus English, Spanish, French, Malay, Shanghainese, and TTS/STT for experimental written-form **闽南话 (Hokkien)** / **客家话 (Hakka)** reply modes.

---

## Features

### Chat & Learning

- **Socratic chat** — locate → choose → explain why → nudge → second chance on mistakes
- **Multi-language & dialect** — English, 普通话 (Mandarin), 粤语 (Cantonese), Español, Français, **Bahasa Melayu (Malay)**; plus experimental written-form support for **闽南话 (Hokkien)** and **客家话 (Hakka)**, and **上海话 (Shanghainese)** with Wu character normalisation for TTS. Voice picker labels are language-only (no engine names). See [design doc](docs/subsystems/dialect-support-teochew-hakka.md) and [Shanghainese](docs/subsystems/shanghainese-support.md).
- **Help & feedback** — sidebar panel: **Ask AI** (default; answers from docs + code, any language, voice/photo/file), browse FAQ, or submit suggestions to GitHub Issues (with feasibility → `docs/TODO.md`). See [faq-feedback-panel.md](docs/subsystems/faq-feedback-panel.md) and [ai-faq.md](docs/subsystems/ai-faq.md).
- **Homework photos & PDFs** — multi-file upload; quote evidence from the right place first
- **Math & diagrams** — LaTeX (KaTeX), SVG geometry via `draw_geometry`, Mermaid; comic/joke SVG viewBoxes auto-expand so labels are not clipped
- **Voice** — neural TTS + STT; Auto language switching; **Listen** on finished assistant messages to replay any history turn. See [voice-tts-stt.md](docs/subsystems/voice-tts-stt.md).
- **Learning memory** — topic mastery, streaks, light badges (never interrupt a stuck moment)
- **Parent hub** — PIN-gated `/family` page: weekly report, charts, mistake coaching, **message student**, learning export
- **Multi-account** — per-account data isolation: each student gets their own chat history, learning progress, and voice preferences. Default = Ryan. Siblings and classmates stay separate.
- **Themes** — four built-in themes (Light, Dark, Light blue, Light green) with WCAG-AA contrast. **Light green is the default.** Switch via the palette button in the header — a collapsed menu keeps the header clean. First-visit visitors and returning users with no saved preference get light green.
- **Tools (silent)** — `web_search`, `fetch_page`, `run_python`, `run_js`, `draw_geometry`
- **History** — searchable chats, photo vault, server sync
- **Code Agent** — vibe-coding panel for live edits to Spark itself, with multi-modal input (images, PDFs, voice, zh/en switch), auto-git pipeline (test gate → commit → push), parent PIN gate
- **Studio / Games** — **Studio** (make & learn) on `/studio` (TED Lab, NatGeo Lab, BBC Doc Lab, RSA Lab, Writing Studio); **Games** (play) on `/entertain`. See [entertainments.md](docs/subsystems/entertainments.md).

### Parent Hub (`/family`)

PIN-gated family dashboard — inspired by Khan Academy's parent view: weekly narrative report, effort radar chart, mistake coaching with severity ranking and actionable tips, learning data export (JSON + printable HTML portfolio), and parent-to-student messaging with Markdown/Mermaid support and read receipts.

### Me Hub & Journal (`/me`)

A personal home for each student: **Facebook Timeline**-style chronological spine grouped by day, mixing journal entries with My Creations (songs, images, videos) and studio challenge results. Private journal with daily Spark prompts, rich text, photos, and camera input. Every new My Creation auto-writes into that day's journal entry. Student-private by default; Family PIN can _read_ (not edit). See [journal-and-me-hub](docs/subsystems/journal-and-me-hub.md).

### Progress (`/dashboard`)

Student-facing **Progress** — BKT skill maps across subjects, recent activity, and practice CTAs. Route stays `/dashboard`; sidebar and Me link use the **Progress** label.

### Dictionary / Translation (`/dict`)

Word lookup **and** AI sentence/photo translation in one page:

**Word (dictionary)**
- **Languages** — English · Español · Français · 中文 (Mandarin) · 粵語 (Cantonese) · Bahasa Melayu · 閩南話 (Hokkien) · 客家話 (Hakka) · 上海話 (Shanghainese)
- **Sources** — Merriam-Webster School Dictionary + Spanish-English (when API keys configured), Free Dictionary / local seeds / translate fallback, local Cantonese dataset (開放粵語字典, CC-BY), plus local Hokkien & Hakka seed lexicons
- **Voice input** — Hold/tap mic (same 16 kHz WAV + `/api/transcribe` pipeline as the main tutor; language follows the selected dict pill)
- **Text-to-speech** — 🔊 beside each headword (edge-tts)
- **Caching** — 24-hour server-side cache; cross-language glosses on results

**Sentence (AI translation)**
- Full sentences / paragraphs via Cursor Agent (LLM)
- **Photo upload & camera** — OCR + translate worksheets, signs, screenshots (up to 3 images)
- From / To language pickers (including Auto-detect → EN/ES/FR/MS/中文/粵語/閩南話/客家話/上海話)
- Learner-friendly notes + speak the translation aloud

Open from the sidebar link **Dictionary / Translation**, or go to `/dict`.

### Studio / Games

Sidebar: **Family | Me** on one row; **Progress** full width; **Studio | Games** on the next; **Code Agent** on the bottom row.

| Route | Content |
|-------|---------|
| `/studio` | **Studio** — TED Lab, NatGeo Lab, BBC Doc Lab, RSA Lab, Writing Studio, My Creations |
| `/entertain` | **Games** — board / arcade / logic games only (`?hub=studio` redirects to `/studio`) |

**Account-scoped learning:** Studio pages show the **active account** chip (avatar · name · grade). TED, NatGeo, BBC, RSA answers and Writing Studio coach/structure turns update that account’s **BKT subject skills** the same way tutor chat does — visible on **Progress**.

**Writing Studio** Stage supports deAPI **text2X**: song · image · video (`POST /api/studio/generate` with `kind`). **Coach** returns a **BASIS writing check** (topic / detail / vocab / grammar scores + craft tip) in a visual panel — not a wall of text. **Structure** is modality-aware (`target: music|image|video`). Writing pad accepts **multilingual mic**, **file / photo → text** (`action: extract`), and **live coach**.

**TED Lab** searches the **live TED catalog** (`GET /api/ted/search` → TED InstantSearch), with **Refresh batch** for newest talks, plus links to open official TED pages. Watch UI keeps a **compact player** with a **sticky “Ready for challenge”** bar on phones.
**NatGeo Lab** — 30 curated National Geographic Kids articles (animals, science, space, history) with grade-banded reading comprehension, video + article hybrid layout.

**BBC Doc Lab** and **RSA Lab** search official YouTube channels live (`GET /api/bbc/search`, `/api/rsa/search`) with English-caption gate and **Refresh batch**, same pattern as TED.

**Media generation** (no local GPU):

1. **Primary** — [deAPI.ai](https://docs.deapi.ai) (`DEAPI_API_KEY`): `txt2music` / `txt2img` / `txt2video`. Works from overseas hosts (Volc often returns `ServerIpLimit`).
2. **Song fallback** — Alibaba Bailian **Fun-Music** (`ALIYUN_DASHSCOPE_API_KEY`), then Volcengine **GenSong** (`VOLC_ACCESS_KEY_ID` / `VOLC_SECRET_ACCESS_KEY`).

Without credentials, lyrics-only drafts still save; generate returns 503.

Open **Studio** or **Games** from the sidebar.
---

### Parent → Student Messaging

Parents can send Markdown messages (including Mermaid diagrams, images, tables) to their child through the PIN-gated `/family` hub:

| Feature | Details |
|---------|---------|
| **Compose** | Markdown editor with title, urgency tag (routine / important / urgent), and preview |
| **Render** | Rich Markdown rendering: headers, bold, lists, code blocks, inline images |
| **Mermaid** | Fenced ` ```mermaid ` blocks render as diagrams (flowchart, graph, sequence) |
| **Urgency** | Three levels — urgent messages get red highlight, important gets amber |
| **Delivery** | Student sees a notification bell in the tutor header (red badge with unread count) |
| **Read tracking** | Parent sees "Read Xm ago" when student opens the message |
| **Storage** | Server-side JSON per student account (`data/accounts/{id}/messages.json`); max 200 messages |

**Student view:** Tap the bell icon → overlay panel with message list → tap to open. Unread messages show a "New" badge. Read state syncs across tabs via `BroadcastChannel`.

**Parent view:** `/family` → PIN unlock → Messages section → compose / browse sent messages / see read receipts.

Messages use the same account model: parent accounts (`role: "parent"`) send messages; student accounts (`role: "student"`) receive them on the same device. Parents do **not** participate in tutoring sessions.



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

### Delivery pipeline

For non-trivial prompts / requirements, Code Agent follows:

1. **Intake** — restate the goal  
2. **Research** — `web_research` / `fetch_page` + codebase search  
3. **Design** — update `docs/subsystems/*` (include test design)  
4. **Plan** — checklist in `docs/TODO.md`  
5. **Implement** — `edit_file` / `write_file` + `run_tests`  
6. **Release** — `apply_changes` (commit) → `publish_develop` (push `origin/develop`)  
7. **Deploy** — `deploy_live` (`npm run build` + `pm2 restart spark-tutor` + health check)

Tiny fixes may skip research/design. Source edits alone do **not** refresh the live site until `deploy_live` succeeds. Details: [docs/subsystems/code-agent-pipeline.md](docs/subsystems/code-agent-pipeline.md).

### What you can ask

The code agent researches, designs, edits, tests, pushes to `develop`, and deploys. Example prompts:

- "Make the text bigger"
- "Add a dark orange accent color"
- "Fix the photo button on mobile"
- "Research Teochew STT options and implement a remediation plan end-to-end"

### Window controls

| Control | How |
|---------|-----|
| **Minimize** | Click the **−** (dash) button in the header — panel collapses to a floating 🤖 bubble at bottom-right. Click the bubble to restore. |
| **Close** | Click the **×** button in the header, or press **Escape**. On mobile, tap the backdrop or swipe down. |
| **New session** | Click **+ New** next to the panel title to start fresh. |
| **Full ACC** | Click **↗ ACC** (if running) to open the Agent Chat Console in a separate tab on port 3001. |

### Diff review & apply

When the agent proposes code changes, it shows a diff block with file name, added (+) and removed (−) line counts. Click **Apply** to accept (requires PIN gate confirmation) or **Cancel** to discard. After applying, a ✓ banner confirms the changes.

### Auto-Git & deploy

After implementation, the agent should:

1. Gate on tests via `apply_changes` (local commit)  
2. `publish_develop` → push `origin/develop`  
3. `deploy_live` → rebuild `.next` + restart PM2 so the public site updates  

A commit / push / deploy status line appears in the agent reply when those tools run.

### Agent Chat Console (port 3001)

A standalone ACC is available at `http://localhost:3001` with the same multi-modal features, plus:

- **File tree explorer** — browse the project filesystem
- **Full chat thread** — persistent session history
- **Auto-git integration** — test → commit → push with real-time status

The mini panel and full `/console` page use the same `/api/console/chat` backend and work without the ACC on port 3001.

---

## Accounts 👤

Spark supports multiple students on a single device — siblings, classmates, or a family tablet shared by 2–3 kids. Each account's data is fully isolated. Accounts sync across devices via the server, so an account created on iPad appears on laptop too.

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
| **Roles** | `student` (default; all learning features) or `parent` (messaging + family hub only) |
| **New accounts** | Each starts fresh with grade-appropriate defaults (G1–G12); parent accounts require only a name |
| **Data isolation** | Chat history, learning memory (BKT), engagement streaks, journal entries, and voice preferences are per-account |
| **Shared settings** | Theme and parent PIN are device-wide (same for every account) |
| **Switching** | Tap the account avatar in the header — instant switch, no login required |
| **Creation gate** | Adding, editing, or deleting accounts requires the parent PIN |
| **Account limit** | Up to 6 accounts per device |
| **Cross-device sync** | Accounts sync globally via server — create on iPad, see on laptop |

Design: **[docs/subsystems/multi-tenant-isolation.md](docs/subsystems/multi-tenant-isolation.md)** — includes header layout spec, industry design references (Khan Academy Kids, ABCmouse, shadcn/ui, Duolingo), and global cross-device account sync. Also see [PIN gate](docs/subsystems/parent-gate.md) and [deletion sync](docs/subsystems/deletion-sync-and-themes.md).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | [Next.js](https://nextjs.org/) 16 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS 4, KaTeX, Mermaid, react-markdown |
| Agent | [Cursor SDK](https://cursor.com/) (`@cursor/sdk`) + in-process tool harness |
| Voice | Local STT service (Whisper + SenseVoice) + Edge neural TTS via `/api/tts` + cloud dialect TTS (Formospeech Hakka, iFlytek, Bailian) |
| Storage | localStorage (per-account namespaced), IndexedDB, server-side JSON files (history, media, learning memory, creations, journal, messages) |
| Ops | systemd service supervision (`spark-tutor`, `spark-stt`, `spark-acc`), health-check gating, auto-git pipeline |
| Tests | Vitest unit tests (200+ files, 1200+ tests) + `verify:*` end-to-end scripts |

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
| `DEAPI_API_KEY` | no | Stage text2X primary (music / image / video via deAPI.ai) |
| `DEAPI_MUSIC_MODEL` / `DEAPI_IMAGE_MODEL` / `DEAPI_VIDEO_MODEL` | no | Override deAPI model slugs |
| `ALIYUN_DASHSCOPE_API_KEY` | no | DashScope / Bailian (TTS + Fun-Music song fallback) |
| `ALIYUN_WORKSPACE_ID` | no | Bailian workspace id when Fun-Music uses Workspace MaaS |
| `FUN_MUSIC_MODEL` / `FUN_MUSIC_BASE_URL` | no | Override Fun-Music model / endpoint |
| `VOLC_ACCESS_KEY_ID` / `VOLC_SECRET_ACCESS_KEY` | no | Volc GenSong song fallback (AccessKey; optional `VOLC_API_KEY_*` aliases) |
| `VOLC_MUSIC_BILLING_ORDER` | no | `prepaid,postpaid` (default) or reverse |
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
│   │       ├── transcribe/         # Speech-to-text (STT)
│   │       ├── tts/                # Text-to-speech (TTS)
│   │       ├── media/              # Photo vault / homework images / song audio
│   │       ├── ted/                # TED search, challenge, discuss, evaluate, transcript
│   │       ├── natgeo/             # NatGeo Kids search, challenge, evaluate
│   │       ├── bbc/                # BBC Doc search, challenge, evaluate
│   │       ├── rsa/                # RSA Shorts search, challenge, evaluate
│   │       ├── writing-studio/       # Coach + grammar-check + legacy song generate
│   │       ├── studio/             # Stage text2X (music / image / video via deAPI)
│   │       ├── creations/          # Studio library CRUD + share tokens
│   │       ├── messages/           # Parent → student messaging
│   │       ├── dict/               # Dictionary lookup + LLM translation
│   │       ├── learning/           # BKT learning data
│   │       ├── journal/            # Journal entries
│   │       ├── accounts/           # Multi-account sync
│   │       ├── setup/              # Setup bootstrap
│   │       └── history/            # Chat history sync
│   ├── components/                 # TutorShell, EntertainPage, TedLab, NatGeoLab, BbcDocLab, RsaShortsLab,
│   │                               #   WritingStudio, CodeAgentPanel, MessageBell, MessageHub, MessageList,
│   │                               #   FamilyControlsPage, Dictionary, HistorySidebar, MeHub, …
│   └── lib/                        # prompts, entertain/*, parent-messages, messages-sync, deapi-client,
│                                   #   fun-music, volc-gensong, media-store, learning-memory, family-report,
│                                   #   journal-store, review-queue, coach-state, …
├── agent-chat/                     # Standalone Agent Chat Console (Next.js, port 3001)
│   ├── public/index.html           # Vanilla JS SPA frontend
│   └── src/
│       ├── app/api/                # chat, workspace, transcribe, setup
│       └── lib/                    # agent, git-ops, attachments, prompts, stt
├── tutor-workspace/                # Agent working notes (AGENTS.md)
├── scripts/                        # ensure-env, health-check, restart-services, verify-*, STT server
├── data/                           # Runtime data (conversations, media, learning-memory, journal, messages, …)
└── docs/                           # Design docs, subsystem specs, TODO — see docs/TODO.md for full index
```

Teaching policy lives mainly in:

- [`src/lib/prompts.ts`](./src/lib/prompts.ts) — system prompt / hint ladder
- [`tutor-workspace/AGENTS.md`](./tutor-workspace/AGENTS.md) — agent instructions

---

## Design Docs

Design documents live in `docs/subsystems/`. Key reads:

| Doc | Topic |
|-----|-------|
| [entertainments](docs/subsystems/entertainments.md) | Studio Learning + games engine architecture |
| [journal-and-me-hub](docs/subsystems/journal-and-me-hub.md) | Journal, Timeline, Me Hub, Stage styles |
| [dictionary-api](docs/subsystems/dictionary-api.md) | Multilingual dictionary + LLM translation |
| [code-agent-pipeline](docs/subsystems/code-agent-pipeline.md) | Code Agent delivery pipeline |
| [multi-tenant-isolation](docs/subsystems/multi-tenant-isolation.md) | Account isolation model |
| [memory-bkt](docs/subsystems/memory-bkt.md) | Bayesian Knowledge Tracing |
| [grade-agnostic-adaptive](docs/subsystems/grade-agnostic-adaptive.md) | K-12 grade-agnostic adaptation |
| [voice-tts-stt](docs/subsystems/voice-tts-stt.md) | Voice pipeline (STT + TTS) |
| [dialect-support-teochew-hakka](docs/subsystems/dialect-support-teochew-hakka.md) | Dialect & language support |
| [geometry-diagrams](docs/subsystems/geometry-diagrams.md) | SVG geometry drawing |
| [storage-sync](docs/subsystems/storage-sync.md) | Storage architecture & sync |
| [parent-gate](docs/subsystems/parent-gate.md) | PIN gate for parent features |
| [faq-feedback-panel](docs/subsystems/faq-feedback-panel.md) | Help & feedback system |
| [product-audit-2026-08-roadmap](docs/subsystems/product-audit-2026-08-roadmap.md) | Product audit & roadmap |
| [ux-competitor-report-2026-08-feasibility](docs/subsystems/ux-competitor-report-2026-08-feasibility.md) | UX competitor analysis |

Full index: **[docs/TODO.md](docs/TODO.md)** — tracks every shipped feature and pending task.

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
npm test                 # unit tests (Vitest) — 200+ files, 1200+ tests
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
- SVG from the model is sanitized before render. See [security sanitization](docs/subsystems/security-sanitization.md).
- Code Agent changes require a **parent PIN gate** before applying edits
- Account creation and deletion are PIN-gated; switching between accounts is PIN-free
- Per-account data isolation via localStorage namespace prefixes (`spark.{accountId}.{module}`)
- Atomic file writes (`tmp+rename`) prevent corruption during concurrent agent sessions

---

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE).

Open source on GitHub: **[zilinli/ryan_learning](https://github.com/zilinli/ryan_learning)**.

---

## Credits

Built as a personal AI tutor for **Ryan** (BASIS G4), with grade-agnostic support (G1–G12) and multi-account isolation. Powered by Cursor's agent SDK, Next.js, and Edge neural voices.
