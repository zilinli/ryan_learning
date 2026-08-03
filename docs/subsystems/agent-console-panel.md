# 🖥 Agent Chat Console Integration

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> **Version**: v0.1.0 | **Date**: 2026-08-04  
> **Status**: Design → Implementation

---

## 1. Problem

The Agent Chat Console (port 3001) is a powerful Cursor-style agent chat that lives as a separate app. Users currently need to manually navigate to `http://65.49.201.123:3001/` in a separate tab. There's **no connection between Spark's tutoring UI and the code-agent UI**.

## 2. Context: Two Console Systems

| System | Purpose | Backend | UI |
|--------|---------|---------|----|
| **Spark Builder** (Improve Spark) | Edit Spark's own code | `/api/console/chat` → Cursor Agent "Spark Builder" | MiniConsoleShell (360px slide-in) + `/console` full page |
| **Agent Chat Console** (port 3001) | General code tasks in workspace | Own `/api/chat` → Cursor Agent "Agent Chat Console" | Standalone vanilla-JS SPA with workspace sidebar, file tree, voice |

These are **fundamentally different systems** — not alternatives. Spark Builder edits Spark. Agent Chat Console is a general-purpose code assistant.

## 3. Integration Approach

### 3.1 Pattern Selection

| Approach | Verdict |
|----------|---------|
| Replace MiniConsole with Agent Chat Console | ❌ Different purposes. Spark Builder is for editing Spark. |
| Merge them into /console page | ❌ /console page is for Spark Builder, max-w-2xl. Agent Chat Console needs sidebar space. |
| Embed as iframe in new panel | ✅ **Chosen**. Same UX pattern as MiniConsoleShell. No modification to Agent Chat Console. |

### 3.2 Rationale for iframe

- **Zero coupling**: Agent Chat Console is a fully independent app. Iframe embedding requires zero changes to it.
- **Same host**: Both run on `65.49.201.123` (Spark:3000, ACC:3001). No cross-origin issues.
- **Proven pattern**: The panel approach (`MiniConsoleShell`) already exists and is well-tested.
- **Self-contained**: The ACC has its own chat state, voice, file tree — iframe preserves all of it without state leakage into Spark.

### 3.3 Design Rule: Non-Intrusive

Per Spark's [design philosophy](../DESIGN.md#-design-philosophy-zero-barrier-for-elementary-students):

> The student only sees conversation. Everything else — language detection, math rendering, diagram repair, voice synthesis, memory tracking — happens invisibly.

The Agent Chat Console is a **parent/admin tool**, not a child-facing feature. Therefore:
- Entry is in the sidebar (behind ☰) — not visible in the main tutoring view
- Labeled with a parent-oriented icon (🛠 or 💻)
- Does not appear in the child's chat flow

## 4. UI Design

### 4.1 Entry Point

In `HistorySidebar`, below the "Improve Spark" button, add a "Code Agent" button:

```
┌──────────────────────────────┐
│  [Search chats…]             │
│                              │
│  ┌──────────────────────────┐│
│  │      + New chat          ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │  🛠  Improve Spark       ││  ← existing
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │  🤖  Code Agent          ││  ← NEW
│  └──────────────────────────┘│
│                              │
│  ─── Chat History ───────── │
│  Fractions homework          │
│  Multiplication practice     │
│  ...                         │
└──────────────────────────────┘
```

### 4.2 Panel Specification

When "Code Agent" is clicked, a **slide-in panel** opens on the right side:

```
┌─────────────────────────┬──────────────────────────────┐
│  ☰ Spark · Ryan  🔊     │                              │
│─────────────────────────│  ┌─── Code Agent ──────[×]─┐ │
│                         │  │                     [↗] │ │
│   Chat messages         │  │                          │ │
│   (tutoring)            │  │   iframe:                │ │
│                         │  │   Agent Chat Console     │ │
│                         │  │   http://...:3001/       │ │
│   [Composer]            │  │                          │ │
│                         │  │                          │ │
└─────────────────────────┴──┴──────────────────────────┴─┘
```

| Property | Value |
|----------|-------|
| Width (desktop ≥1024px) | `min(520px, 45vw)` — wider than MiniConsole (360px) to fit the file tree sidebar |
| Width (tablet 640–1023px) | `min(480px, 55vw)` |
| Width (mobile <640px) | Full-width bottom sheet (`max-h-[70vh]`) |
| Animation | `animate-slide-in-left` (same as MiniConsoleShell) |
| Z-index | `z-30` (same as MiniConsoleShell) |
| Header | "Code Agent" title + [↗] open-in-new-tab button + [×] close |
| iframe | `src="http://65.49.201.123:3001/"`, `width="100%"` `height="100%"` |
| Backdrop | Semi-transparent overlay on mobile |

### 4.3 Why Wider Than MiniConsole

MiniConsole (360px) is adequate for a compact diff viewer. The Agent Chat Console has a **two-column layout** (chat + 300px file-tree sidebar). At 360px, both columns would be squeezed. 480–520px gives enough room for the file tree (narrowed to ~180px) and the chat area.

### 4.4 Visual Hierarchy in HistorySidebar

```
Improve Spark     ← teal outline button (existing)
Code Agent        ← teal outline button (new, immediately below)
```

Both share the same visual style: `border-teal/30 bg-teal/10`. The "Code Agent" button uses 🤖 icon to differentiate from 🛠 (which implies "fix/improve").

## 5. Component Architecture

```
TutorShell.tsx
  ├── HistorySidebar.tsx          ← ADD: "Code Agent" button + onOpenCodeAgent prop
  ├── MiniConsoleShell.tsx        ← existing (unchanged)
  ├── AgentConsolePanel.tsx       ← NEW: iframe panel for Agent Chat Console
  └── ... (chat components)
```

### 5.1 New Component: `AgentConsolePanel`

```typescript
// src/components/AgentConsolePanel.tsx
type Props = {
  open: boolean;
  onClose: () => void;
};

export function AgentConsolePanel({ open, onClose }: Props) {
  if (!open) return null;
  
  return (
    <>
      {/* Desktop: slide-in panel */}
      <div className="hidden lg:block">
        <div className="fixed right-0 top-0 z-30 flex h-dvh w-[min(520px,45vw)] flex-col ...">
          <header>...</header>
          <iframe src="http://65.49.201.123:3001/" ... />
        </div>
      </div>
      
      {/* Mobile: bottom sheet */}
      <div className="fixed inset-0 z-30 lg:hidden">
        <backdrop onClick={onClose} />
        <div className="absolute inset-x-0 bottom-0 max-h-[70vh] ...">
          <iframe ... />
        </div>
      </div>
    </>
  );
}
```

### 5.2 Changes to Existing Files

| File | Change |
|------|--------|
| `HistorySidebar.tsx` | Add `onOpenCodeAgent?: () => void` prop; add "Code Agent" button below "Improve Spark" |
| `TutorShell.tsx` | Add `agentPanelOpen` state; wire `handleOpenCodeAgent`; render `<AgentConsolePanel>` |

### 5.3 iframe Configuration

```html
<iframe
  src="http://65.49.201.123:3001/"
  title="Agent Chat Console"
  className="h-full w-full border-0"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  loading="lazy"
/>
```

`sandbox` attributes:
- `allow-scripts` — needed for the vanilla JS SPA
- `allow-same-origin` — needed to make API calls to port 3001
- `allow-forms` — needed for chat input
- `allow-popups` — for "open in new tab" links
- **No** `allow-top-navigation` — prevent ACC from navigating Spark's window
- **No** `allow-modals` — not needed

## 6. Accessibility & Keyboard

| Action | Key |
|--------|-----|
| Close panel | Escape |
| Open panel | Click "Code Agent" in sidebar |
| Focus trap | iframe handles its own focus; panel close with Escape |

## 7. Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| ACC (port 3001) not running | iframe shows browser's default error page. Add `onError` handler to show a fallback message: "Agent Chat Console is not running. Start it with `./start.sh`." |
| User resizes window | Panel width uses `vw` units — auto-adjusts |
| Mobile device | Bottom sheet with drag handle, max 70vh |
| User opens ACC in new tab | `↗` button in panel header → `window.open(ACC_URL, '_blank')` |
| iframe steals focus | iframe does its own focus management; parent only handles Escape |

## 8. Implementation Plan

| Step | File | Change |
|------|------|--------|
| 1 | `src/components/AgentConsolePanel.tsx` | Create new component (desktop slide-in + mobile bottom sheet with iframe) |
| 2 | `src/components/HistorySidebar.tsx` | Add `onOpenCodeAgent` prop and "Code Agent" button |
| 3 | `src/components/TutorShell.tsx` | Add `agentPanelOpen` state, wire to sidebar, render panel |

**Risk**: Low. Pure additive change. No modifications to existing working systems.

---

> **References**:
> - [Agent Chat Console Technical Design](../../agent-chat/docs/tech-design.md)
> - [Spark Design Philosophy](../DESIGN.md#-design-philosophy-zero-barrier-for-elementary-students)
> - [UI Architecture](../subsystems/ui-architecture.md)
