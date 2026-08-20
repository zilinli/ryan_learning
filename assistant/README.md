# OpenClaw Assistant — unified module

Replaces the archived repos:

- [zilinli/ai_assistant_mac](https://github.com/zilinli/ai_assistant_mac)
- [zilinli/ai_assistant_win](https://github.com/zilinli/ai_assistant_win)

Single codebase for **macOS** and **Windows**, with stubs for future **iOS** / **Android**.

## Layout

```
assistant/
├── install.mjs              # Cross-platform entry (Node 22+)
├── openclaw-config/         # Shared config + platform overlays
├── platforms/darwin|win32/  # Platform-specific install extras
└── scripts/                 # merge-config, merge-skills
```

## Manual install (dev)

```bash
cd codes/ryan_learning/assistant
node install.mjs
```

## Spark deploy

Use `/deploy` on Spark — the one-click installer downloads this module and runs `install.mjs` after pairing.

## Platform skills

Skills with OS-specific commands store:

- `SKILL.md` — shared frontmatter
- `darwin.md` / `win32.md` — appended at install time

## Backup

- macOS: `bash platforms/darwin/backup.sh`
- Windows: `powershell platforms/win32/backup.ps1`
