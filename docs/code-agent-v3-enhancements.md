# Code Agent v3 — Multi-Modal Input, Auto-Git, Service Resilience

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **design** · August 2026  
> Scope: Agent Chat Console (port 3001) + system-level ops

---

## 1. Problem Statement

The Agent Chat Console (ACC) is a vanilla-JS SPA at port 3001 that lets developers modify the Spark project via natural language. Currently it has three critical gaps:

1. **No file upload** — cannot accept images or PDFs for multi-modal agent prompts
2. **No voice input** — text-only, no STT integration despite the STT server being available on port 8765
3. **No auto-git** — code agent modifies files but never commits or pushes; deploy cycle is manual
4. **No service restart verification** — starting services after crash or deploy has no health-check gate

---

## 2. Architecture: Current State

```
┌─────────────────────────────────────────────────────────────────┐
│ Agent Chat Console (port 3001)                                   │
│                                                                  │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐│
│  │  public/index.html       │   │  API Routes (Next.js)        ││
│  │  ┌────────────────────┐  │   │                              ││
│  │  │ Chat UI            │  │   │  POST /api/chat     → SSE   ││
│  │  │ - text input        │──┼──▶│  GET  /api/workspace→ tree ││
│  │  │ - workspace sidebar │  │   │  GET  /api/.../file → read ││
│  │  │ - file preview      │  │   │  POST /api/transcribe→STT ││
│  │  │ - voice (basic)     │  │   │  GET/PUT/DEL /api/history ││
│  │  └────────────────────┘  │   │                              ││
│  └──────────────────────────┘   └──────────────┬───────────────┘│
│                                                  │               │
│                                          ┌───────▼────────┐      │
│                                          │ Cursor SDK      │      │
│                                          │ Agent.create()  │      │
│                                          │ run.stream()    │      │
│                                          └────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**Gaps identified (based on codebase exploration):**
- `ChatRequest` type already has a placeholder `attachments?:` field — unused
- `public/index.html` has a basic voice toggle but no multi-language selection (zh/en)
- `src/lib/workspace.ts` has file read/write — git operations do not exist
- Systemd services exist (`spark-tutor`, `spark-stt`) but no ACC systemd unit; start.sh has port pre-flight but no post-launch health verification

---

## 3. Design: Feature A — Image & PDF Upload

### 3.1 Reuse Existing Upload Pipeline

The main Spark project has a mature file upload pipeline in `src/lib/file-payload.ts` and `src/lib/attachments.ts`. We reuse these patterns in `agent-chat/` rather than duplicating.

### 3.2 Data Flow

```
Camera / File Picker
  │
  ▼
File → fileToAttachment()           [reuse src/lib/file-payload.ts pattern]
  │  - image: compress→base64 dataUrl
  │  - pdf:   read as dataUrl (base64)
  │  - text:  read as text, clip 80KB
  │
  ▼
ClientAttachment[] → POST /api/chat
  │  attachments: [{ name, mimeType, kind, data, textContent? }]
  │
  ▼
buildFileSummaries()                [reuse src/lib/extract-files.ts pattern]
  │  - pdf → pdftotext extraction
  │  - text → decode from base64
  │  - image → dataUrl inline in prompt
  │
  ▼
Injected into system prompt before user message
  │  "--- File: photo.jpg (image) ---"
  │  "[image data not extracted]" 
  │  "--- File: worksheet.pdf (pdf) ---"
  │  "<extracted text>..."
  │
  ▼
Cursor SDK Agent.send() — agent sees the files as context
```

### 3.3 Files Changed — Frontend

| File | Change |
|------|--------|
| `agent-chat/public/index.html` | New `#input-row` layout: camera button + upload paperclip + textarea + voice + send. Hidden `<input type="file" accept="image/*,.pdf">` + `<input type="file" capture="environment" accept="image/*">`. Attachment pills with thumbnail previews below input bar. |
| `agent-chat/src/lib/prompts.ts` | `buildAttachmentLines(attachments)` — produces compact file descriptions for the system prompt |

### 3.4 Files Changed — Backend

| File | Change |
|------|--------|
| `agent-chat/src/lib/types.ts` | Extend `ChatRequest` — `attachments?: { name; mimeType; kind; data?; textContent? }[]`. Add `ChatAttachment` type |
| `agent-chat/src/app/api/chat/route.ts` | Accept `attachments` in request body; pass to `streamAgentResponse()` |
| `agent-chat/src/lib/agent.ts` | `streamAgentResponse()` accepts optional `attachments` param; calls `buildAttachmentLines()` to inject context |
| `agent-chat/src/lib/prompts.ts` | New `buildAttachmentLines()` function — extracts text from PDFs (pdftotext), decodes text files, marks images as context; clips to 12KB |

### 3.5 MIME Support Matrix

| Kind | Extensions | Handler | Action |
|------|-----------|---------|--------|
| Image | `.jpg .jpeg .png .gif .webp .heic` | `readAsDataURL` + compress | Inline data URL in prompt |
| PDF | `.pdf` | `readAsDataURL` → server: `pdftotext` | Extracted text as code block |
| Text | `.txt .md .csv .json .log .ts .tsx .js .py` | `readAsText` | Inline in prompt |
| Other | (blocked) | `isAllowedAttachment` | Error: "unsupported file type" |

---

## 4. Design: Feature B — Chinese/English Voice Input

### 4.1 Current State

`public/index.html` has a basic voice toggle that:
- Tries `window.SpeechRecognition` / `webkitSpeechRecognition` with hardcoded `zh-CN` lang
- Falls back to `MediaRecorder` → server STT via `POST /api/transcribe`

**Missing:** Language switching (zh / en), visual feedback per language, auto-resume after transcription.

### 4.2 Target UX

```
┌─────────────────────────────────────────┐
│  🎤 🌐  Agent Chat Console    + 新建    │
│─────────────────────────────────────────│
│  ┌──────────────────────────────────┐   │
│  │ 🎤 zh │ 📎  │ Type here... │ ➤  │   │
│  └──────────────────────────────────┘   │
│           ↑                              │
│     tap to switch zh↔en                 │
└─────────────────────────────────────────┘
```

### 4.3 Language Switching

A small lang toggle button ("zh" / "en") in the input bar. Clicking toggles:
- Web Speech API `recognition.lang` between `"zh-CN"` and `"en-US"`
- Server STT: sends `language` param in FormData
- Visual: button shows active language code, pulse animation while recording

### 4.4 Files Changed

| File | Change |
|------|--------|
| `agent-chat/public/index.html` | New lang toggle button in `#input-row`. `voiceLang` state variable. `toggleVoiceLang()` switches between `zh-CN` and `en-US`. Visual pulse on `.btn-voice.recording`. After transcription: auto-reset recording state, focus input |
| `agent-chat/src/lib/stt.ts` | (Already has `detectSpeechLang()` — no changes needed, but we wire it into the frontend) |

---

## 5. Design: Feature C — Auto-Commit + Push to Develop

### 5.1 Safety Constraints

This is a sensitive operation. The design follows a strict gate:

```
Code Agent modifies project files
  │
  ▼
Agent sends SSE "done" event
  │
  ▼  [Frontend intercepts]
Was there a file change detected in the stream?
  │  (tool_call events with edit_file / write_file)
  │
  ▼  NO → skip
  │
  ▼  YES
Execute npm test
  │
  ├── FAIL → skip commit; report test failures to user
  │
  ▼  ALL PASS
git add -A
git commit -m "code-agent: <file list or user prompt summary>"
git push origin develop
  │
  ▼  [SSE final event]
Include commit SHA in "done" event for UI display
```

### 5.2 Implementation Approach

The auto-git workflow runs **server-side** as part of the `/api/chat` endpoint's completion phase. This avoids client-side reliability issues.

### 5.3 Git Workflow Script

New endpoint or server-side hook in `agent-chat/src/app/api/chat/route.ts`:

```
POST /api/chat complete → if file changes detected:
  1. spawn("npm", ["test"], { cwd: WORKSPACE, timeout: 120s })
  2. If exitCode !== 0 → yield error event, skip commit
  3. spawn("git", ["add", "-A"], { cwd: WORKSPACE })
  4. spawn("git", ["commit", "-m", message], { cwd: WORKSPACE })
  5. spawn("git", ["push", "origin", BRANCH], { cwd: WORKSPACE })
```

### 5.4 Commit Message Convention

```
code-agent: <action summary> (n files)

- src/components/Foo.tsx: changed color token
- src/lib/bar.ts: fixed null check
```

Where `<action summary>` is derived from the user's original prompt (first 80 chars).

### 5.5 Settings

| Name | Location | Default | Description |
|------|----------|---------|-------------|
| `AUTO_GIT_ENABLED` | `agent-chat/.env.local` | `true` | Feature toggle |
| `AUTO_GIT_BRANCH` | `agent-chat/.env.local` | `develop` | Target branch |
| `AUTO_GIT_REQUIRE_TESTS` | `agent-chat/.env.local` | `true` | Gate on test pass |

### 5.6 Files Changed

| File | Change |
|------|--------|
| `agent-chat/src/lib/git-ops.ts` | 🆕 NEW — `runTests()`, `stageAndCommit()`, `pushBranch()`, `detectFileChanges()` using `child_process.execFile` |
| `agent-chat/src/app/api/chat/route.ts` | Post-stream hook: if `AUTO_GIT_ENABLED` and changes detected, call git workflow via `git-ops.ts` |
| `agent-chat/src/lib/types.ts` | Extend `AgentStreamEvent` — `commitSha?: string`, `commitMessage?: string`, `testResult?: "pass" | "fail" | "skipped"` |
| `agent-chat/public/index.html` | Render commit SHA + test result in final "done" event display |

---

## 6. Design: Feature D — Service Restart with Verification

### 6.1 Current State

`start.sh` kills ports and starts services but has no verification. Systemd services auto-restart but have no cross-service health checks.

### 6.2 Target Flow

```
restart-services.sh
  │
  ├── 1. Stop: systemctl stop spark-stt spark-tutor
  │     kill any residual on :3000 :3001 :8765
  │
  ├── 2. Start: systemctl start spark-stt
  │     │
  │     ├── wait 5s, GET http://127.0.0.1:8765/health → ⏳ retry (max 60s)
  │     │  └── FAIL → ERROR: "STT service failed to start"
  │     │
  │     └── ✅ STT healthy
  │
  ├── 3. Start: systemctl start spark-tutor
  │     │
  │     ├── wait 3s, GET http://127.0.0.1:3000/api/setup → 200
  │     ├── GET http://127.0.0.1:3000/ → 200 (page loads)
  │     └── ✅ Spark healthy
  │
  ├── 4. Start agent-chat: cd agent-chat && nohup npm run dev &
  │     │
  │     ├── GET http://127.0.0.1:3001/ → 200
  │     ├── GET http://127.0.0.1:3001/api/setup → 200 (or ok)
  │     └── ✅ ACC healthy
  │
  └── 5. Summary: print status table
```

### 6.3 Systemd Unit for ACC

Create `/etc/systemd/system/spark-acc.service` so the Agent Chat Console benefits from the same supervision as the other services.

### 6.4 Files Changed

| File | Change |
|------|--------|
| `scripts/restart-services.sh` | 🆕 NEW — graceful stop → ordered start → health-check each service with timeout + retry |
| `scripts/health-check.mjs` | 🆕 NEW — standalone health checker: `node scripts/health-check.mjs` checks all 3 services, exits 0/1, JSON output |
| `/etc/systemd/system/spark-acc.service` | 🆕 NEW — systemd unit for agent-chat on port 3001 |
| `agent-chat/src/app/api/setup/route.ts` | 🆕 NEW — health endpoint returning `{ ok: true, service: "agent-chat", port: 3001 }` |
| `start.sh` | Update to call health verification after launch |

### 6.5 Health Check Matrix

| Service | Port | Check | Timeout | Retries | Interval |
|---------|------|-------|---------|---------|----------|
| STT | 8765 | `GET /health` → 200 | 60s | 12 | 5s |
| Spark Tutor | 3000 | `GET /api/setup` → 200 | 30s | 6 | 5s |
| Spark Tutor | 3000 | `GET /` → 200 (HTML) | 15s | 3 | 5s |
| Agent Chat Console | 3001 | `GET /` → 200 | 15s | 3 | 5s |

---

## 7. File Change Summary

| # | File | Type | Feature |
|---|------|------|---------|
| 1 | `agent-chat/public/index.html` | ✏️ Modify | A: file upload UI + B: zh/en voice toggle + C: commit display |
| 2 | `agent-chat/src/lib/types.ts` | ✏️ Modify | A: ChatAttachment type + C: commit fields in AgentStreamEvent |
| 3 | `agent-chat/src/lib/prompts.ts` | ✏️ Modify | A: buildAttachmentLines() + B: voiceLang hint in prompt |
| 4 | `agent-chat/src/lib/agent.ts` | ✏️ Modify | A: accept attachments param |
| 5 | `agent-chat/src/app/api/chat/route.ts` | ✏️ Modify | A: forward attachments + C: post-stream git hook |
| 6 | `agent-chat/src/lib/git-ops.ts` | 🆕 New | C: git add/commit/push + npm test gate |
| 7 | `agent-chat/src/app/api/setup/route.ts` | 🆕 New | D: health check endpoint |
| 8 | `scripts/restart-services.sh` | 🆕 New | D: ordered restart with verification |
| 9 | `scripts/health-check.mjs` | 🆕 New | D: standalone health checker |
| 10 | `/etc/systemd/system/spark-acc.service` | 🆕 New | D: ACC systemd unit |
| 11 | `start.sh` | ✏️ Modify | D: call health verification post-launch |

---

## 8. Test Plan

### Unit Tests
| Test | Scope |
|------|-------|
| `git-ops.test.ts` | `runTests()` — pass/fail/timeout; `stageAndCommit()` — empty diff, file add, multi-file; `pushBranch()` — success/Auth failure; `detectFileChanges()` — from tool_call events |
| `prompts.test.ts` | `buildAttachmentLines()` — image, pdf text, text file, mixed, empty, large clip |

### Integration Tests
| Test | Scope |
|------|-------|
| `verify-agent-chat-upload.mjs` | POST chat with image attachment → verify SSE returns delta events; POST with PDF → verify text extraction in prompt |
| `verify-agent-chat-voice.mjs` | POST transcribe with audio blob → verify text response; test zh and en language params |
| `verify-auto-git.mjs` | Modify a temp file via agent, verify git log shows commit, verify test gate blocks on failing test |
| `verify-service-health.mjs` | Call `health-check.mjs`, verify all services report ok; kill one service, verify detection |

### Manual QA
- Upload photo via camera button → confirm it appears in agent prompt
- Upload PDF → confirm text extracted
- Voice: tap zh, record → confirm Chinese transcript; switch to en, record → English
- Code agent: "add a comment to Foo.tsx" → verify auto-commit + push to develop
- `bash scripts/restart-services.sh` → verify all services healthy

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Git push fails (auth/network) | Medium | Low | Non-blocking — notify user, don't crash; agent code already applied |
| npm test hangs indefinitely | Low | Medium | `child_process.execFile` with 120s timeout; SIGTERM → SIGKILL cascade |
| Large file uploads OOM | Low | Medium | 12MB client limit + 12KB server clip; reject files > limit before read |
| STT server unavailable for ACC voice | Medium | Low | Fallback to browser SpeechRecognition; if both fail, show "voice unavailable" |
| `restart-services.sh` kills production traffic | Low | High | Script checks if called interactively; warns with 5s countdown; tracks pid ownership |
