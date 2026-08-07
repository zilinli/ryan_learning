# Spark Code Agent — Mini Window UI Design

> Version 1.0 · August 2026  
> Status: Design for mini window vibe-coding UX fix

---

## 1. Problem Statement

The "Code Agent" button in the sidebar opens `AgentConsolePanel` — an iframe to a separate Agent Chat Console on port 3001. This has three critical issues:

| Issue | Root Cause | User Impact |
|-------|-----------|-------------|
| **Mini window is empty** | Port 3001 service down → iframe loads blank/error page | User sees nothing, thinks feature is broken |
| **Cannot close the window** | If iframe loads but renders blank, the header with X button may be hidden or unreachable | User is trapped, must refresh page |
| **Not vibe coding** | Iframe to separate app = disconnected experience, no inline diff/apply | User can't iteratively improve Spark from within the chat |

Additionally, a fully-functional vibe-coding component **already exists** (`MiniConsoleShell.tsx`) with chat, SSE streaming, diff viewing, and apply-with-PIN capabilities — but it was **never wired into the UI** (orphaned, no imports).

---

## 2. Current Architecture (Broken State)

```
TutorShell.tsx
  └── HistorySidebar.tsx
        └── "Code Agent" button → handleOpenCodeAgent()
              └── setAgentPanelOpen(true)
                    └── AgentConsolePanel.tsx  ← iframe to port 3001
                          └── <iframe src="http://hostname:3001/">  ← BLANK if service down
                                └── No error handling
                                └── No sandbox attribute
                                └── Wrong slide animation (slide-in-left for right panel)

ORPHANED (never rendered):
  MiniConsoleShell.tsx  ← Real vibe coding: chat + code agent SSE + diff + apply + PIN
  ├── MiniConsoleThread.tsx     ← Shows last 3 messages, 300-char truncation
  ├── ConsoleComposer.tsx       ← Single-line input, Enter to send
  ├── MiniDiffViewer.tsx        ← Compact 5-line diff with "Apply"/"Cancel"
  └── PinGate.tsx               ← Parental PIN before applying changes
```

---

## 3. Proposed Architecture (Vibe Coding Mini Window)

Replace `AgentConsolePanel` with a new unified component that embeds real vibe coding:

```
TutorShell.tsx
  └── HistorySidebar.tsx
        └── "Code Agent" button
              └── setCodeAgentOpen(true)
                    └── CodeAgentPanel.tsx  ← NEW (merge MiniConsoleShell + branding)
                          │
                          ├── Header: "🤖 Code Agent" + "↗ ACC tab" + "✕ Close"
                          │
                          ├── Mini chat thread (last 3 messages, max 500 chars ea.)
                          │   └── Empty state: 🛠 icon, hint examples
                          │
                          ├── Phase: "idle" | "thinking" | "diff" | "applied" | "error"
                          │   ├── thinking → pulsing dots + status
                          │   ├── diff → MiniDiffViewer + Apply/Cancel buttons
                          │   ├── applied → auto-reset after 3s
                          │   └── error → retryable error banner
                          │
                          ├── Composer (single-line, Enter=send; 📷 uses CameraCapture live viewfinder)
                          │
                          └── Connection to /api/console/chat (SSE)
                              ├── Uses Cursor SDK agent
                              ├── Tools: read_file, edit_file, run_tests, git_diff, etc.
                              └── Streams deltas in real-time
```

### 3.1 Why This Works

The underlying infrastructure is already complete:
- `/api/console/chat/route.ts` — fully functional SSE endpoint with Cursor SDK agent
- `console-harness.ts` — 8 sandboxed code editing tools (read, search, edit, test, diff, apply, revert, list)
- `console-session-store.ts` — server-side session persistence
- `MiniConsoleThread.tsx` — chat display (already built, just needs wiring)
- `ConsoleComposer.tsx` — input with Enter-to-send; camera uses `CameraCapture` modal (live viewfinder, same as main chat Composer)
- `MiniDiffViewer.tsx` — diff with apply/cancel
- `PinGate.tsx` — parental PIN before code changes

All that's needed is wiring and UX polish.

---

## 4. Detailed UX Specification

### 4.1 Window States

```
┌──────────────────────────────────────────┐
│ ← Close          🤖 Code Agent    ↗ ACC │  ← Header bar (always visible)
├──────────────────────────────────────────┤
│                                          │
│  IDLE STATE:                             │
│  ┌──────────────────────────────────┐    │
│  │           🛠                      │    │
│  │   Tell Spark how to improve      │    │
│  │                                  │    │
│  │   Try:                           │    │
│  │   • Make the text bigger         │    │
│  │   • Add a dark orange accent     │    │
│  │   • Fix the photo on mobile      │    │
│  │   • Show math steps one by one   │    │
│  └──────────────────────────────────┘    │
│                                          │
│  THINKING STATE:                         │
│  ┌──────────────────────────────────┐    │
│  │ You: Make the text bigger        │    │
│  │ 🛠 Builder: (streaming reply…)   │    │
│  │ ● ● ●  Reading files…            │    │
│  └──────────────────────────────────┘    │
│                                          │
│  DIFF STATE:                             │
│  ┌──────────────────────────────────┐    │
│  │ 🛠 Builder: Changed globals.css   │    │
│  │ +10 -3                            │    │
│  │ ┌──────────────────────────┐      │    │
│  │ │ - font: 14px;            │      │    │
│  │ │ + font: 18px;            │      │    │
│  │ └──────────────────────────┘      │    │
│  │ [Apply] [Cancel]                   │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ Tell Spark what to improve…      │    │
│  │                           [Send] │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### 4.2 Layout Dimensions

| Breakpoint | Width | Position | Animation |
|-----------|-------|----------|-----------|
| Desktop (≥1024px) | `min(420px, 42vw)` | Right slide-in panel (`fixed right-0 top-0`) | `animate-slide-in-right` (250ms ease-out) |
| Tablet (768-1023px) | `min(380px, 48vw)` | Right slide-in panel | `animate-slide-in-right` |
| Phone (<768px) | Full width, `max-h-[65vh]` | Bottom sheet | `animate-slide-up` (250ms ease-out) |

### 4.3 Close Behavior

| Trigger | Action |
|---------|--------|
| ✕ button in header | Close panel |
| Escape key | Close panel |
| Click backdrop (mobile bottom sheet) | Close panel |
| Swipe down on bottom sheet handle (mobile) | Close panel |

**Key fix**: The close button is rendered INSIDE the slide-in panel div (not in a separate overlay), so it's always visible at the top of the panel regardless of content loading state.

### 4.4 Error Handling

| Error | User Sees | Recovery |
|-------|-----------|----------|
| `/api/console/chat` returns 503 | "Service starting… try again in a moment" | Retry button |
| Agent run times out (120s) | "Taking too long — try a simpler request" | Auto-retry prompt |
| Network error (fetch fails) | "Connection lost — tap ↻ to retry" | Retry button |
| No API key | "API key not configured" | Link to setup |
| Agent error (non-retryable) | Error message + "Start new session" button | Clear session, restart |

### 4.5 Vibe Coding UX Principles

Inspired by [vibe-editor](https://github.com/yusei531642/vibe-editor), [Cursor App Builder](https://github.com/cursor/cookbook), and [VibeWorkspace](https://www.vibe-workspace.cloud/):

1. **Chat-first, not form-first**: User describes intent in natural language, agent responds with code changes
2. **Diff-first review**: Changes shown as compact diffs (not full files), with line counts (+N -M)
3. **One-click apply/undo**: Apply with PIN gate for safety, revert with one click
4. **Streaming feedback**: Agent status ("Reading…", "Editing…", "Testing…") shows what's happening
5. **Session persistence**: Conversation survives page refresh; resume from where you left off
6. **Tool transparency**: Show which tools are being used (read_file, edit_file, etc.) as status updates

---

## 5. Implementation Plan

### 5.1 Phase A: Wire MiniConsoleShell → replace AgentConsolePanel (3h)

| Task | Details |
|------|---------|
| Rename `MiniConsoleShell` → `CodeAgentPanel` | Reflect actual purpose; remove confusion with external ACC |
| Wire into `TutorShell.tsx` | Replace `AgentConsolePanel` import and `agentPanelOpen` state with the new component |
| Use existing `MiniConsoleShell` logic | Keep chat, SSE, diff, apply, PIN gate — it's already built |
| Remove `AgentConsolePanel.tsx` | No longer needed (or keep as "full screen ACC" option only) |
| Fix animation: `slide-in-left` → `slide-in-right` | Right-side panels should slide from the right |
| Ensure close button always visible | X button in header rendered unconditionally |

### 5.2 Phase B: Empty State & Loading UX (2h)

| Task | Details |
|------|---------|
| Empty state with guided hints | Show example prompts: "Make text bigger", "Add dark mode color", "Fix photo on mobile" |
| Loading skeleton when stream starts | Skeleton + status badge while agent initializes |
| Tool status display | Show badge: "Reading…", "Searching code…", "Editing…", "Testing…" |
| Connection error fallback | If port 3001 ACC is available, show "Open in new tab" link as alternative |

### 5.3 Phase C: Close Button & Mobile Fixes (1.5h)

| Task | Details |
|------|---------|
| Close button in header (always visible) | Button at top-right of panel, not dependent on content |
| Mobile bottom sheet close | Backdrop tap + swipe-down handle + X button |
| Escape key close | Already implemented, verify it works |
| Prevent body scroll when panel open | `document.body.style.overflow = "hidden"` on open, restore on close |

### 5.4 Phase D: Thread & Composer Polish (2h)

| Task | Details |
|------|---------|
| Increase message limit from 300 → 500 chars | 300 too short; 500 allows meaningful code snippets |
| Show more than 3 messages | Keep last 5 messages visible in mini thread |
| Auto-scroll to bottom | Scroll thread to latest message on new content |
| Composer: disable while agent thinking | Prevent user from sending overlapping requests |
| Composer: placeholder text rotation | Cycle through hint examples in placeholder |

### 5.5 Phase E: Session Management (1.5h)

| Task | Details |
|------|---------|
| Load previous session on open | Read from server-side store, restore last messages |
| "New session" button | Clears session, starts fresh — prevents context bloat |
| Session list (future) | In full-screen mode, show past sessions |

---

## 6. Key Code Changes

### 6.1 TutorShell.tsx — Wire the new component

```typescript
// Change:
import { AgentConsolePanel } from "./AgentConsolePanel";
// To:
import { CodeAgentPanel } from "./CodeAgentPanel";

// Change state name:
const [agentPanelOpen, setAgentPanelOpen] = useState(false);
// To:
const [codeAgentOpen, setCodeAgentOpen] = useState(false);

// Change render:
<AgentConsolePanel open={agentPanelOpen} onClose={() => setAgentPanelOpen(false)} />
// To:
<CodeAgentPanel open={codeAgentOpen} onClose={() => setCodeAgentOpen(false)} />
```

### 6.2 HistorySidebar.tsx — Button handler stays the same

```typescript
// Rename callback prop for clarity:
onOpenCodeAgent → already set, no change needed
handleOpenCodeAgent → already set, no change needed
```

### 6.3 Fix animation in globals.css

```css
/* Add new keyframe */
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

/* Panel uses animate-slide-in-right instead of animate-slide-in-left */
```

### 6.4 CodeAgentPanel.tsx — Merged component (pseudocode)

```typescript
export function CodeAgentPanel({ open, onClose }: Props) {
  // Merge MiniConsoleShell logic:
  // - session management
  // - SSE streaming to /api/console/chat
  // - diff detection and display
  // - PIN gate for apply
  // - phase state machine
  
  // Add from AgentConsolePanel:
  // - "Code Agent" branding (not "Improve Spark")
  // - ACC link as secondary option
  // - Proper close button that ALWAYS renders
  // - Fix slide animation direction
  
  // New additions:
  // - Empty state with guided hints
  // - Loading skeleton
  // - Error state with retry
  // - Body scroll lock
}
```

---

## 7. Accepting Criteria

- [ ] Click "Code Agent" in sidebar → slide-in panel appears with empty state (hints visible)
- [ ] Type a prompt → agent streams reply → diff shown when code changes detected
- [ ] Click "Apply" → PIN gate → changes committed
- [ ] Click "Cancel" → diff dismissed
- [ ] Click ✕ → panel closes
- [ ] Press Escape → panel closes
- [ ] Mobile: tap backdrop → panel closes
- [ ] Mobile: swipe down on handle → panel closes
- [ ] If service is down → friendly error with retry
- [ ] Panel does not block body scrolling of main content
- [ ] Previously sent messages are visible (at least last session)
- [ ] "Open in ACC" link opens port 3001 in new tab (if available)

---

## 8. References

- [Vibe Editor — Multi-agent infinite canvas](https://github.com/yusei531642/vibe-editor) — Chat-first, diff-first UX pattern
- [Cursor App Builder — SDK cookbook](https://github.com/cursor/cookbook/tree/main/sdk/app-builder) — Next.js + Cursor SDK reference implementation with chat + iframe preview
- [VibeWorkspace](https://www.vibe-workspace.cloud/) — "Prompts, terminals, browser errors, and AI diffs stay together" pattern
- [AI SDK Elements](https://ai-sdk.dev/elements/overview) — Production React components for streaming chat UI
- [Existing MiniConsoleShell code](./src/components/MiniConsoleShell.tsx) — Already-built vibe coding shell (orphaned)
- [Existing ConsoleHarness tools](./src/lib/console-harness.ts) — 8 sandboxed code editing tools for the agent
