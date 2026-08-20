# OpenClaw Assistant — unified module

Cross-platform OpenClaw configuration for **macOS** and **Windows**, with stubs for future **iOS** / **Android**. Replaces the archived standalone repos:

- [zilinli/ai_assistant_mac](https://github.com/zilinli/ai_assistant_mac)
- [zilinli/ai_assistant_win](https://github.com/zilinli/ai_assistant_win)

Spark `/deploy` downloads this tree (as `assistant.tar.gz`), runs `install.mjs`, and starts **Spark Bridge** so `/control` can chat with the local agent.

**Design doc:** [docs/subsystems/remote-openclaw-control.md](../docs/subsystems/remote-openclaw-control.md)

---

## Layout

```
assistant/
├── install.mjs                 # Cross-platform entry (Node 22+)
├── openclaw-config/
│   ├── openclaw.base.json      # Shared OpenClaw config
│   ├── darwin.json / win32.json # Platform overlays (merged at install)
│   ├── workspace/              # AGENTS.md, SOUL.md, skills, memory
│   ├── workbench/              # Local workbench app files
│   └── cursor/                 # Cursor agent workspace sync
├── platforms/
│   ├── darwin/                 # install.sh, backup.sh, LaunchAgent helpers
│   ├── win32/                  # install.ps1, backup.ps1
│   ├── ios/README.md           # Stub
│   └── android/README.md       # Stub
└── scripts/
    ├── merge-config.mjs        # base + platform → ~/.openclaw/openclaw.json
    └── merge-skills.mjs        # SKILL.md + darwin.md|win32.md → merged skill
```

---

## What `install.mjs` does

1. Creates `~/.openclaw` layout (agents, workspace, tasks, costs, workbench).
2. Merges `openclaw.base.json` with `darwin.json` or `win32.json`.
3. Syncs workspace docs (`AGENTS.md`, `WEIXIN_COMMANDS.md`, …) and **skills**.
4. Merges platform-specific skill appendices (`darwin.md` / `win32.md`).
5. Copies workbench to `~/openclaw-workbench` (preserves history/sessions).
6. Runs `platforms/<platform>/install.sh` or `install.ps1` (venv, gateway, etc.).

---

## Skills (15)

| Skill | Purpose |
|-------|---------|
| `computer-use` | Screen / shell automation (OS-specific notes) |
| `cursor-code` | Cursor IDE agent integration |
| `workbench` | Local workbench UI |
| `office-docs` | Word / Excel / PPT helpers |
| `deep-research` | Web research workflows |
| `memory-rag` | Long-term memory / RAG |
| `media-gen` | Image / video generation |
| `music-gen` | Music generation |
| `data-analysis` | Tables, charts, Python |
| `cost-tracker` | API spend tracking |
| `connectors-basic` | External connectors |
| `command-correct` | Shell command repair |
| `task-deliver` | Task completion / delivery |
| `fun-mode` | Light entertainment mode |
| `organize-messy-files-file-organizer` | File cleanup |

Each skill folder contains `SKILL.md`; many also have `darwin.md` and `win32.md` for platform commands.

---

## Manual install (development)

```bash
cd codes/ryan_learning/assistant
node install.mjs
```

Requires Node 22+, OpenClaw CLI on `PATH`, and API keys in `~/.openclaw` (or via Spark install-ticket).

---

## Spark deploy (production)

1. Open **[Deploy](https://spark-tutor-for-ryan.duckdns.org/deploy)** on Spark.
2. Generate a pair code (admin token if configured).
3. Download **Spark-Deploy-&lt;CODE&gt;.command** (Mac) or **.bat** (Windows) and run it.
4. Node appears online; use **Control** to chat.

**Upgrade:** On `/deploy`, click **Upgrade from server** on an online node to pull the latest `assistant.tar.gz` and `spark-bridge.mjs`.

---

## Backup

- macOS: `bash platforms/darwin/backup.sh`
- Windows: `powershell platforms/win32/backup.ps1`

Backs up `~/.openclaw`, workbench state, and bridge config.

---

## Rebuild server bundle

After editing this directory:

```bash
cd codes/ryan_learning
tar czf public/install/assistant.tar.gz assistant
pm2 restart spark-control
```

Bump bridge version in `public/install/spark-bridge.mjs` when bridge logic changes.
