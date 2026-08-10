# Code Agent — Mobile Disconnect & Context Resume

> Version 1.0 · 2026-08-10  
> Related: [code-agent-mini-window.md](code-agent-mini-window.md), [code-agent-robustness.md](code-agent-robustness.md)

---

## 1. Problem

On phones, switching apps / locking the screen / flaky radio tears down the fetch SSE to `POST /api/console/chat`. Today the route listens to `req.signal` abort and calls `agent.close()`, so **background work stops**. React state is in-memory only, so reopening the panel loses mid-run context even though the session id may still exist.

User need: **disconnect must not stop the agent**; **reopen must restore conversation + in-flight run**.

---

## 2. Approach

Decouple the Cursor agent run from the HTTP SSE consumer (Soliplex / SSE resume pattern):

1. **Detached run** — `driveConsoleRun()` lives in a process-global store; client abort only closes the SSE controller.
2. **Run event buffer** — each `status` / `delta` / `tool_call` / `done` / `error` is appended with a monotonic `id`.
3. **GET snapshot** — `GET /api/console/chat?sessionId=` returns messages + `activeRun` (status, runId, fullText, lastEventId).
4. **Optional reattach SSE** — `GET ...&runId=&after=` streams events after `after` until the run finishes.
5. **Client persistence** — localStorage holds msgs / phase / runId / streaming snippet; on `visibilitychange` → visible, poll or reattach until done.

```
Mobile UI ──POST──► start run (detached) ──► console-run-store
         ◄──SSE─── tail events (abort = close stream only)
         ──GET───► messages + activeRun snapshot / reattach SSE
```

---

## 3. Key files

| File | Role |
|------|------|
| `src/lib/console-run-store.ts` | In-memory run + event buffer, session→run index |
| `src/app/api/console/chat/route.ts` | Detached drive + GET snapshot/reattach; no `agent.close()` on abort |
| `src/lib/mini-console-store.ts` | Persist panel context (msgs, phase, runId) |
| `src/components/CodeAgentPanel.tsx` | Save/restore + visibility resume |
| `src/lib/types.ts` | `ConsoleRunSnapshot` / extended mini state |

---

## 4. Risks

| Risk | Mitigation |
|------|------------|
| Next.js may cancel request work on abort | Drive run outside the abort path (global promise + store) |
| Memory growth from old runs | Cap events per run; TTL prune finished runs (~30 min) |
| Dual clients same session | One active run per sessionId; new POST supersedes |
| PM2 restart mid-run | Run lost (same as today); session messages still restore |

---

## 5. Test design

### Unit
- `console-run-store`: create → append → eventsAfter → finish; session active index; prune.
- `mini-console-store`: save/load panel context including `runId` + messages.

### Integration / route contract
- Route source contains detached run + does **not** `agent.close()` inside the abort listener.
- GET path returns `messages` and `activeRun`.

### Manual (phone)
1. Start a long Code Agent prompt → switch to another app 30s → return: status still thinking or completed with full reply.
2. Kill network briefly mid-run → reopen panel: context + final answer from server.
3. Soft-reload page with panel open: last messages restore from localStorage/server.
