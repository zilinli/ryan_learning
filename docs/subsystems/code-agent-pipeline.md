# Code Agent Delivery Pipeline

> Version 1.0 · 2026-08-10  
> Related: [code-agent-deploy.md](code-agent-deploy.md), [code-agent-mini-window.md](code-agent-mini-window.md), [code-agent-v3-enhancements.md](../code-agent-v3-enhancements.md)

---

## 1. Goal

When a user enters a **prompt or requirement** in Code Agent (sidebar panel, `/console`, or ACC), the agent follows a fixed delivery pipeline instead of jumping straight to `edit_file`:

```
P0 Intake
 → P1 Research (web + codebase)
 → P2 Design (docs/subsystems + test design)
 → P3 Plan (docs/TODO.md checklist)
 → P4 Implement (code + unit tests)
 → P5 Release (commit → push origin/develop)
 → P6 Deploy (npm run build + pm2 restart + health)
```

Tiny one-line fixes may shortcut P1–P3 (see SYS).

---

## 2. Tools

| Tool | Phase | Role |
|------|-------|------|
| `web_research` | P1 | Web search (reuse tutor `webSearch`) |
| `fetch_page` | P1 | Fetch URL → cleaned text |
| `search_code` / `read_file` / `list_files` | P1–P4 | In-repo context |
| `write_file` | P2–P4 | New docs / modules |
| `edit_file` | P2–P4 | Patches |
| `run_tests` | P4–P5 | Vitest gate |
| `git_diff` | P5 | Review |
| `apply_changes` | P5 | Local commit (tests must pass) |
| `publish_develop` | P5 | `git push` to `origin/develop` (must be on `develop`) |
| `deploy_live` | P6 | `npm run build` + `pm2 restart spark-tutor` + HTTP health |
| `revert_changes` | — | Undo uncommitted work |

Edit budget: **25** `write_file` + `edit_file` calls per session.

Dry-runs for tests: `CONSOLE_DEPLOY_DRY_RUN=1`, `CONSOLE_PUBLISH_DRY_RUN=1`.

---

## 3. System prompt

Source of truth: `src/lib/console-sys.ts` (`CONSOLE_SYS`), imported by `src/app/api/console/chat/route.ts`.

Contract highlights:

- Narrate the current phase.
- Design docs under `docs/subsystems/` must include a **test design** section.
- TODO updates happen **before** large coding.
- Live site stays stale until `deploy_live` succeeds.

---

## 4. UI entry points

- Sidebar **Code Agent** mini panel  
- `/console` full page  
- Optional ACC `:3001`  

All share `/api/console/chat` + `createConsoleHarnessTools()`.

Input: text, images, PDFs, voice (same multi-modal stack as before).

---

## 5. Test plan

| ID | Case |
|----|------|
| CD1 | Tools include `deploy_live` |
| CD1b | Tools include `web_research`, `fetch_page`, `write_file`, `publish_develop` |
| CD2 | `deploy_live` dry-run |
| CD2b | `publish_develop` dry-run |
| CD3 | `CONSOLE_SYS` mentions P1–P6, `publish_develop`, `web_research`, Max 25 |
| CD4 | Edit budget = 25 then throw |

---

## 6. Ops notes

- Prefer working on branch `develop`.
- Never force-push; never commit `.env*`.
- After `publish_develop`, still call `deploy_live` for user-visible `src/` changes on this host.
