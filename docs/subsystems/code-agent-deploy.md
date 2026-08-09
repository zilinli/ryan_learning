# Code Agent → Live Service Deploy Gap

> Version 1.0 · 2026-08-09  
> Related: [code-agent-mini-window.md](code-agent-mini-window.md), [build-optimization.md](build-optimization.md)

---

## 1. Problem (observed)

User runs the **same prompt** in Code Agent as in Cursor IDE chat; source files may change, but **the public site does not update**.

### Root cause

| Layer | Behavior |
|-------|----------|
| Live process | PM2 `spark-tutor` → `npm run start` → serves **production** `.next` |
| Code Agent tools | `edit_file` / `apply_changes` touch **source** (+ optional git commit) |
| Missing step | **No rebuild / no `pm2 restart`** after edits |

Evidence on host (2026-08-09): `.next/BUILD_ID` older than `src/lib/entertain/xiangqi-local.ts` → running bundle stale vs working tree.

Secondary limits that make long prompts fail mid-way:

- SYS workflow never mentioned deploy.
- Max **5** `edit_file` calls per session → complex features abort early.
- `apply_changes` only `git commit`s — does not push and does not rebuild.

---

## 2. Design fix

### 2.1 New tool: `deploy_live`

Runs in project root (`process.cwd()` = `/root/codes/ryan_learning`):

1. `npm run build` (smart-build: stops formospeech, heap-capped Next build, restarts TTS)
2. `pm2 restart spark-tutor`
3. HTTP health check `GET http://127.0.0.1:3000/` expect `200`

Returns JSON `{ ok, phase, http?, log? }`.  
Dry-run: `CONSOLE_DEPLOY_DRY_RUN=1` → no side effects (unit tests).

Timeout: build ≤ 240s (console route `maxDuration` = 300).

### 2.2 SYS prompt contract

After any change under `src/` / `public/` / `next.config.*` that affects the running app:

```
edit_file → run_tests → deploy_live → (optional) apply_changes
```

Tell the user explicitly that source edits alone do **not** refresh production until `deploy_live` succeeds.

### 2.3 Edit budget

Raise max edits per session **5 → 15** so research/design/implement prompts can finish.

---

## 3. Test plan

| ID | Case |
|----|------|
| CD1 | `createConsoleHarnessTools()` exposes `deploy_live` |
| CD2 | Dry-run returns `ok:true` with `dryRun:true` (no build) |
| CD3 | SYS string in `console/chat/route.ts` mentions `deploy_live` and stale-`.next` |
| CD4 | Max edit counter allows 15 edits before throw |

---

## 4. Delivery checklist

- [x] Design doc (this file)
- [x] `deploy_live` in `console-harness.ts`
- [x] SYS prompt update
- [x] Edit limit 15
- [x] Tests CD1–CD4
- [x] Build + restart (so Code Agent itself picks up the new tool)
- [x] Git push
