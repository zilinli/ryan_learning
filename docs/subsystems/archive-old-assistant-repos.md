# Archive README — paste into ai_assistant_mac / ai_assistant_win

Use this as the **top section** of each repo README when archiving on GitHub (Settings → Archive repository).

---

## ARCHIVED — moved to Spark

This repository is **archived**. Development continues in the unified module:

**[ryan_learning/assistant](https://github.com/zilinli/ryan_learning/tree/master/assistant)** (inside the Spark / ryan_learning monorepo)

One assistant now supports **macOS** and **Windows**, with stubs for iOS/Android.

### What changed

| Before | After |
|--------|-------|
| Two repos (mac / win) | Single `assistant/` module |
| Manual `install.ps1` / backup scripts | Spark `/deploy` one-click + `assistant/install.mjs` |
| Platform-specific `openclaw.json` | `openclaw.base.json` + `overlays/{darwin,win32}.json` |

### Install on a new PC

Open **[Deploy OpenClaw](https://spark-tutor-for-ryan.duckdns.org/deploy)**, generate a pair code, run the macOS or Windows command.

Do **not** clone this archived repo for new installs.

---

## Original README (historical)

<!-- Keep the rest of the old README below for reference, or delete after archiving. -->
