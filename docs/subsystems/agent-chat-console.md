# 🛠 Agent Chat Console — Self-Improvement Agent

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **design** · August 2026  
> Owner: Spark

---

## 1. Concept

The **Agent Chat Console** lets Ryan (the student) tell Spark how to improve itself — in plain chat. Ryan types what he wants ("make the font bigger", "stop asking so many questions", "add a heart emoji when I get it right"), and a Cursor SDK agent reads the codebase, makes changes, runs tests, and shows the diff.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Ryan:  "Can you please make the voice speak slower?"           │
│                                                                  │
│   ┌─────────────────┐     ┌─────────────────────────────────┐   │
│   │  Agent Console   │ ──→ │  Cursor SDK Agent               │   │
│   │  (chat UI)       │     │  Tools: read, edit, test, git   │   │
│   └─────────────────┘     └─────────────────────────────────┘   │
│                                       │                           │
│                                       ▼                           │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Agent:  "I increased the speech rate in tts-text.ts.    │   │
│   │           Tests pass. Here's the diff — accept?"         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Why This Exists

| Need | How The Console Fulfills It |
|------|----------------------------|
| Ryan finds a UX problem | Types it in plain language — agent fixes it |
| Ryan wants a new feature | Agent reads code, creates code, runs tests |
| Ryan wants Spark's personality changed | Agent edits prompts, runs tests, shows diff |
| Adult isn't available to code | Cursor agent acts as the developer |

**This is NOT a "coding for kids" tool.** Ryan doesn't write code. He writes **requests**. The agent translates natural language into tested code changes.

---

## 2. Design Philosophy

### 2.1 Minimal Intrusion

The console is **not part of the main tutoring flow**. A 9-year-old should never accidentally open it. Access is:

- **Desktop/Tablet**: A subtle "🛠" icon in the sidebar footer (last item, below "New Chat")
- **Phone**: Hidden behind ⚙️ in the hamburger menu → "Improve Spark" link
- **URL direct**: `/console` — bookmarked by parent for Ryan to use when needed
- **Security**: Parent PIN gate (numeric `localStorage` PIN, set once) — prevents unsupervised code changes

### 2.2 It's a Conversation, Not a Terminal

```
BAD (terminal-feeling):
  > grep speech-player.ts | sed ...
  > npm run build

GOOD (conversation):
  Ryan: "Make the voice slower"
  Agent: "I'll slow down the speech rate from 1.0x to 0.85x.
          I changed tts-text.ts line 42. Tests pass.
          Here's what it looks like now: [diff block]
          Want me to apply this?"
  Ryan: "Yes!"
  Agent: "Done! Restart Spark and you'll hear the difference."
```

### 2.3 Show, Don't Just Tell

Every code change comes with:
1. A plain-English explanation of what was changed
2. A syntax-highlighted diff block
3. Test results (green = pass, red = fail)
4. "Apply" / "Revert" / "Show more" buttons

### 2.4 Safety by Default

- Agent cannot delete the `.git` folder, `.env.local`, or `config/`
- Maximum 5 file changes per session
- All changes are staged in git — revertible
- "Dry run" mode: show changes first, apply on approval
- Test must pass before applying (or agent must explain why it's safe)

---

## 3. User Experience

### 3.0 Mini-Console — Embedded on Main Page

The primary interaction mode is a **compact popover panel** that lives on the Spark main page. Ryan can type a request, see the agent's thinking progress, and view the diff summary — all without leaving his tutoring screen. For detailed diff review or multi-turn conversations, a "↗ Open full console" link expands to the dedicated `/console` page.

**Why embedded-first:** A 9-year-old shouldn't navigate to a separate "developer page." The mini-console feels like asking Spark to improve itself — part of the same conversation.

#### 3.0.1 Trigger

```
Desktop/Tablet (>640px):
┌─────────────────────────────────────┐
│ 🛠 Improve Spark                    │  ← link at the bottom of sidebar footer
└─────────────────────────────────────┘
     │ click
     ▼
  Mini-console panel slides up from sidebar footer (or pops over as a panel)

Phone (<640px):
┌─────────────────────────────────────┐
│ 🛠 Improve Spark                    │  ← inside hamburger menu
└─────────────────────────────────────┘
     │ click
     ▼
  Mini-console panel slides up as bottom sheet (60% of screen height)
```

#### 3.0.2 Mini-Console Panel Layout

```
Desktop/Tablet (embedded sidebar panel, ~360px wide, pinned to right edge):
┌──────────────────────────────────────────────────────────┐
│  ← Back to Spark    🛠  Improve Spark            [×]    │  ← header
│──────────────────────────────────────────────────────────│
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 👋 Tell me how to improve Spark.                   │  │
│  │                                                    │  │
│  │ ────────────────────────────────────────────────── │  │
│  │ You: "Make fonts bigger in chat"                   │  │
│  │                                                    │  │
│  │ 🛠 Builder: I found the font size in                │  │
│  │ globals.css. Changing 16px → 18px...               │  │
│  │                                                    │  │
│  │ 📄 globals.css  (+1 −1)                            │  │
│  │ ┌──────────────────────────────────────────────┐   │  │
│  │ │ - Chat message body | 16px                   │   │  │
│  │ │ + Chat message body | 18px                   │   │  │
│  │ └──────────────────────────────────────────────┘   │  │
│  │                                                    │  │
│  │ ✅ 291 tests pass                                  │  │
│  │                                                    │  │
│  │ [Apply]  [Show full diff]  [Cancel]                │  │
│  │                                                    │  │
│  │ ↗ Open full console  (for multi-file diffs &       │  │
│  │    detailed code review)                            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ "Make fonts bigger"                            ↗   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘

Phone (bottom sheet, slides up from bottom, 60vh):
┌──────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────┐  │
│  │ ──── drag handle ────                     [×]     │  │
│  │                                                    │  │
│  │ 🛠 Improve Spark                                   │  │
│  │                                                    │  │
│  │ [Same compact messages as above — scrollable]      │  │
│  │                                                    │  │
│  │ ↗ Open full console                                │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ "Make fonts bigger"                            ↗   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

#### 3.0.3 Mini-Console States

| State | Mini-Console Behavior |
|-------|----------------------|
| **Closed (default)** | Nothing visible except the sidebar/hamburger link |
| **Opening** | Panel slides in (250ms ease-out) — desktop: from right; phone: from bottom |
| **Idle** | Welcome prompt + input field ready |
| **Thinking** | Mini skeleton: "🛠 Builder is reading the code…" with pulsing dots |
| **Diff preview** | Compact diff (first hunk only, ±5 lines context) + "Show full diff" button |
| **Test running** | "⏳ Running tests…" with elapsed timer |
| **Apply confirm** | PIN gate overlay on top of mini-console (same PIN design as §5) |
| **Done** | "✅ Applied! Restart to see changes." with "↗ Review in full console" link |
| **Error** | Coral banner inside panel: what went wrong |

#### 3.0.4 Transition: Mini → Full Console

When Ryan (or a parent) wants to see more — multi-file diffs, full agent explanation, session history — the "↗ Open full console" link navigates to `/console`. The full console inherits the same session, so the conversation continues seamlessly.

```
Mini-Console                          Full Console (/console)
┌──────────────────┐                  ┌──────────────────────────────┐
│ Quick request +   │  ↗ click →      │ Full chat history            │
│ compact diff      │                  │ Multi-file diffs side-by-side│
│ Apply in-place    │                  │ Complete agent explanations  │
│ "↗ Open full…"    │                  │ "← Back to Spark" link       │
└──────────────────┘                  └──────────────────────────────┘
```

**State transfer:** `localStorage.spark.consoleSessionId` carries the session between mini and full modes. When the full console loads, it reads the same session from `data/console/sessions/`.

#### 3.0.5 Mini-Console vs Full Console — Feature Table

| Feature | Mini-Console (embedded) | Full Console (/console) |
|---------|------------------------|------------------------|
| Where | Spark main page (sidebar/panel) | Dedicated page |
| Input | Single-line text + Enter | Multi-line textarea |
| Diff display | Single-file, first hunk ±5 lines | Multi-file, full context, expandable |
| Test results | Pass/fail count + status | Full test output + error logs |
| History | Last 3 messages only | Full session history with scrollback |
| Apply | After PIN confirm | After PIN confirm |
| Multi-turn chat | No (single request-reply) | Yes (full conversation) |
| Screen space | ~360px sidebar panel / 60vh sheet | Full viewport |
| Primary user intent | Quick fix ("make fonts bigger") | Complex changes, review, exploration |

---

### 3.1 Entry Points

```
Desktop/Tablet (>640px):
┌─────────────────────┐
│  [Sidebar]          │
│  New Chat           │
│  ───────────────    │
│  Chat 1             │
│  Chat 2             │
│  ...                │
│  ───────────────    │
│  🛠 Improve Spark   │  ← click → opens mini-console panel (slides in from right)
└─────────────────────┘

Phone (<640px):
┌─────────────────────┐
│  ☰   ✨ Spark·Ryan  │
│  ───────────────    │
│  New Chat           │
│  ...                │
│  🛠 Improve Spark   │  ← click → opens mini-console bottom sheet (60vh)
└─────────────────────┘
```

Both entry points open the **mini-console** (§3.0). The full console at `/console` is reached via the "↗ Open full console" link inside the mini-console panel, or by direct URL navigation.

### 3.2 Full Console Layout (`/console` page)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to Spark    🛠  Improve Spark                 [×]   │  ← 48px header
│──────────────────────────────────────────────────────────────│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 👋 Hi Ryan! I can help improve Spark.                   │ │
│  │                                                         │ │
│  │ Tell me what you want to change, and I'll:              │ │
│  │ • Read the code to understand how it works              │ │
│  │ • Make changes and run tests                            │ │
│  │ • Show you the difference before applying               │ │
│  │                                                         │ │
│  │ Try: "Make the voice slower" or "Add a welcome          │ │
│  │       message when I open Spark"                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Ryan: "Make fonts bigger in chat"                │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Agent: I'll increase the chat message font from  │       │
│  │ 16px to 18px. Let me check the code first...     │       │
│  │                                                   │       │
│  │ --- globals.css (line 216-219) ---                │       │
│  │ -  font-size: 16px;                               │       │
│  │ +  font-size: 18px;                               │       │
│  │                                                   │       │
│  │ ✅ 282 tests pass. Want me to apply this?         │       │
│  │ [Apply] [Show full diff] [Cancel]                 │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│──────────────────────────────────────────────────────────────│
│  ┌──────────────────────────────────────────────────────┐   │
│  │  "Make the voice slower"                         ↗    │   │
│  └──────────────────────────────────────────────────────┘   │
│                        ↑                                     │
│              Input (same Composer component)                 │
│              Enter = send, Shift+Enter = newline             │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Message Bubble Design

**Agent messages** with code changes:
```
┌───────────────────────────────────────────────────┐
│ 🛠 Spark Builder                                  │
│ ┌───────────────────────────────────────────────┐ │
│ │ I found the issue in `src/lib/tts-text.ts`.   │ │
│ │ The chunking step limits sentences to 200     │ │
│ │ chars by default. I increased it to 350.      │ │
│ │                                               │ │
│ │ 📄 tts-text.ts  (+3 -3)                       │ │
│ │ ┌───────────────────────────────────────────┐ │ │
│ │ │  3  | export const MAX_CHUNK = 200        │ │ │
│ │ │     | -export const MAX_CHUNK = 200       │ │ │
│ │ │     | +export const MAX_CHUNK = 350       │ │ │
│ │ │  4  |                                     │ │ │
│ │ └───────────────────────────────────────────┘ │ │
│ │                                               │ │
│ │ ✅ Tests: 291 passed, 0 failed                │ │
│ └───────────────────────────────────────────────┘ │
│ ┌──────┐ ┌───────────┐ ┌────────┐               │
│ │Apply │ │Show diff  │ │Cancel  │               │
│ └──────┘ └───────────┘ └────────┘               │
└───────────────────────────────────────────────────┘
```

**User messages** (simple text):
```
                                   ┌──────────────────┐
                                   │ Make fonts bigger│
                                   └──────────────────┘
                                               Ryan
```

### 3.4 States

| State | Visual |
|-------|--------|
| **Idle (first open)** | Welcome message with examples |
| **Thinking** | Pulsing dots in agent bubble + "Reading codebase…" |
| **Found + Diff** | Green/red diff block + "Apply" buttons |
| **Applying** | Spinner + "Writing files…" |
| **Applied** | Green check + "Done! Restart to see changes" |
| **Error** | Coral banner: what went wrong + "Try again" |
| **Test failure** | Red diff + "Tests failed: [details]. I need to fix this." |
| **PIN gate** | "Enter parent PIN to continue" modal overlay |

### 3.5 Device Behavior

| Device | Entry | Layout | Input |
|--------|-------|--------|-------|
| **Desktop (≥1024px)** | Sidebar footer | Side-by-side: console chat + diff panel | Hardware KB |
| **Tablet (640–1023px)** | Sidebar footer | Full-width console | Soft KB |
| **Phone (<640px)** | Hamburger menu | Full-width console | Soft KB |

---

## 4. Technical Architecture

### 4.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Spark Main Page (/)                                       │ │
│  │  ┌────────────────────┐    ┌────────────────────────────┐  │ │
│  │  │  TutorShell        │    │  MiniConsole (embedded)    │  │ │
│  │  │  ┌──────────────┐  │    │  ┌──────────────────────┐  │  │ │
│  │  │  │ ChatThread   │  │    │  │ MiniConsoleShell     │  │  │ │
│  │  │  │ Composer     │  │    │  │ MiniConsoleThread    │  │  │ │
│  │  │  │ VoiceControls│  │    │  │ MiniDiffViewer       │  │  │ │
│  │  │  └──────────────┘  │    │  │ PinGate              │  │  │ │
│  │  └────────────────────┘    │  │ ↗ Open full console  │  │  │ │
│  │                            │  └──────────────────────┘  │  │ │
│  │                            └────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Full Console Page (/console)                              │ │
│  │  ┌────────────────────┐                                    │ │
│  │  │ ConsoleShell       │                                    │ │
│  │  │ ConsoleThread      │                                    │ │
│  │  │ DiffViewer (full)  │                                    │ │
│  │  │ ConsoleComposer    │                                    │ │
│  │  │ PinGate            │                                    │ │
│  │  └────────────────────┘                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                      │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │ SSE
┌──────────────────────────────────────┼──────────────────────────┐
│                        Next.js Server                           │
│                                      │                          │
│  ┌────────────────────┐    ┌─────────▼────────────────────┐    │
│  │ /api/chat          │    │ /api/console/chat             │    │
│  │ (tutor prompt)     │    │ (builder prompt + code tools) │    │
│  │ ┌──────────────┐   │    │ ┌──────────────────────────┐ │    │
│  │ │ tutor-harness│   │    │ │ console-harness          │ │    │
│  │ │ web_search   │   │    │ │ read_file, edit_file     │ │    │
│  │ │ draw_geometry│   │    │ │ search_code, run_tests   │ │    │
│  │ │ run_python   │   │    │ │ git_status, git_diff     │ │    │
│  │ └──────────────┘   │    │ │ apply_changes            │ │    │
│  └────────────────────┘    │ └──────────────────────────┘ │    │
│                            └──────────────────────────────┘    │
│                                      │                          │
│  ┌────────────────────┐             │                          │
│  │ data/console/      │  ◀─────────┘ (session logs)            │
│  │   sessions/*.json  │                                        │
│  └────────────────────┘                                        │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Components

| Component | File | Role |
|-----------|------|------|
| `MiniConsoleShell` | `src/components/MiniConsoleShell.tsx` | **Embedded** mini-console panel — slides in from sidebar (desktop) or bottom sheet (phone); manages SSE + state for single-turn quick requests |
| `MiniConsoleThread` | `src/components/MiniConsoleThread.tsx` | Compact message list (last 3 messages) with inline diff preview |
| `MiniDiffViewer` | `src/components/MiniDiffViewer.tsx` | Single-file, first-hunk-only diff (±5 lines context) |
| `ConsoleShell` | `src/components/ConsoleShell.tsx` | **Full** console page orchestrator — SSE, state, multi-turn, diff approval |
| `ConsoleThread` | `src/components/ConsoleThread.tsx` | Full message list with code diff blocks and action buttons |
| `ConsoleComposer` | `src/components/ConsoleComposer.tsx` | Multi-line composer (text only, no camera/voice) for full console |
| `DiffViewer` | `src/components/DiffViewer.tsx` | Syntax-highlighted full unified diff display (multi-file support) |
| `PinGate` | `src/components/PinGate.tsx` | PIN entry modal — shared between mini and full console |
| `ConsoleHarness` | `src/lib/console-harness.ts` | Agent tools: `read_file`, `edit_file`, `search_code`, `run_tests`, `git_diff`, `apply_changes` |
| `ConsoleAPI` | `src/app/api/console/chat/route.ts` | SSE endpoint, builder prompt, sandbox config (used by both mini and full) |
| `ConsolePage` | `src/app/console/page.tsx` | Full console page entry (Next.js route) |
| `ConsoleSessionStore` | `src/lib/console-session-store.ts` | Server-side session persistence (shared between mini and full) |
| `types.ts` (extended) | `src/lib/types.ts` | `DiffBlock`, `ConsoleMessage`, `FileChange`, `MiniConsoleState` types |

### 4.3 Console Harness Tools

```typescript
// src/lib/console-harness.ts

const CONSOLE_TOOLS = [
  {
    name: "read_file",
    description: "Read a file from the Spark codebase. Returns the full content.",
    parameters: { filepath: "string (relative to project root)" },
    execute: async ({ filepath }) => {
      // Validate path is within project root
      // Read file, return content with line numbers
    }
  },
  {
    name: "search_code",
    description: "Search across the Spark codebase with regex, keywords, or patterns.",
    parameters: { query: "string", glob?: "string" },
    execute: async ({ query, glob }) => {
      // Use ripgrep to find matches
      // Return file paths, line numbers, and context
    }
  },
  {
    name: "edit_file",
    description: "Apply an exact string replacement to a file. MUST provide enough context to uniquely identify the target.",
    parameters: {
      filepath: "string",
      old_string: "string (must be unique in file)",
      new_string: "string",
    },
    execute: async ({ filepath, old_string, new_string }) => {
      // Validate path
      // Backup original to .console-backups/
      // Apply replacement
      // Stage in git
      // Return success/failure
    }
  },
  {
    name: "run_tests",
    description: "Run the full vitest test suite (or a single file). Returns pass/fail counts.",
    parameters: { file?: "string (optional test file to run)" },
    execute: async ({ file }) => {
      // Run `npx vitest run [file]` with 30s timeout
      // Parse output for pass/fail counts and error messages
      // Return structured result
    }
  },
  {
    name: "git_diff",
    description: "Show current uncommitted changes as a unified diff.",
    parameters: {},
    execute: async () => {
      // Run `git diff`
      // Return as string
    }
  },
  {
    name: "apply_changes",
    description: "Commit and apply all staged changes. This is the final approval step.",
    parameters: { message: "string (commit message)" },
    execute: async ({ message }) => {
      // git add -A (excluding forbidden paths)
      // git commit with message
      // Return new commit hash
    }
  },
  {
    name: "revert_changes",
    description: "Undo ALL uncommitted changes. Use this if tests fail or user rejects.",
    parameters: {},
    execute: async () => {
      // git checkout -- .
      // git clean -fd
      // Delete console-backups
    }
  },
  {
    name: "list_files",
    description: "List files in a directory (non-recursive).",
    parameters: { dirpath: "string" },
    execute: async ({ dirpath }) => {
      // Validate path
      // Return list of filenames
    }
  },
];
```

### 4.4 Safety Constraints

| Constraint | Implementation |
|-----------|---------------|
| Path traversal prevention | All paths validated with `path.resolve` + check under project root |
| Forbidden paths | Cannot touch: `.git/`, `node_modules/`, `.env*`, `config/secret*`, `data/` |
| File size limit | `read_file` max 5000 lines; `edit_file` rejection if file > 2000 lines |
| Change limit per session | Max 5 file edits + 1 apply |
| Pin gate | `localStorage` parent PIN (4 digits, set once, hashed) |
| Backup | Every edit backed up to `.console-backups/` before modification |
| Test-gated apply | `apply_changes` rejected if tests don't pass (agent must fix first) |
| Dry-run | All changes visible as diff before apply; `revert_changes` available anytime |
| Agent prompt safety | System prompt explicitly forbids: deleting files, editing config/secret, modifying `.gitignore`, changing PIN logic, disabling safety checks |

### 4.5 API Route: `/api/console/chat`

```typescript
// src/app/api/console/chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes for test runs

POST(request: Request) {
  // 1. Parse body: { sessionId, message, pin? }
  // 2. Validate PIN (from localStorage pin hash)
  // 3. Build builder system prompt with:
  //    - Project file tree summary
  //    - Current git status
  //    - Safety rules
  // 4. Create Cursor SDK agent with console tools
  // 5. Stream response via SSE
  //    Events: delta, status, diff, test-result, done, error
}
```

### 4.6 System Prompt (Builder Agent)

```
You are Spark Builder — you improve the Spark AI Tutor codebase.

SYSTEM CONTEXT:
- Project: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- User: Ryan, age 9, BASIS G4 student
- Primary language: English + Cantonese (粤语)
- Codebase root: /root/codes/ryan_learning
- Key directories: src/app/ (routes), src/components/ (UI),
  src/lib/ (logic), docs/ (design docs)
- Test command: npx vitest run
- Tests are in *.test.ts files alongside source code

SAFETY RULES (DO NOT VIOLATE):
1. NEVER edit .git/, node_modules/, .env*, config/secret*, data/
2. NEVER delete files — only edit with edit_file
3. ALWAYS run tests after making changes
4. NEVER apply changes if tests fail
5. NEVER change this safety logic or the PIN gate
6. Max 5 file edits per conversation

WORKFLOW:
1. Understand Ryan's request in plain language
2. Search the codebase to find relevant files
3. Read the files to understand the code
4. Make targeted edits with edit_file
5. Run tests to verify
6. Show the diff to Ryan with git_diff
7. Ask Ryan to approve before applying
8. Apply with apply_changes only after approval

REPLY STYLE:
- Explain changes in simple, 9-year-old-friendly language
- Show code diffs with syntax highlighting
- Always show test results (pass ✅ or fail ❌)
- If a test fails, explain why and try to fix it
- Be encouraging and positive — Ryan is learning!
```

### 4.7 Client-Side State

```typescript
// New types in types.ts
type DiffBlock = {
  filepath: string;
  hunks: string;  // unified diff hunks
  added: number;
  removed: number;
};

type ConsoleMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  diffs?: DiffBlock[];
  testResults?: { passed: number; failed: number; output: string };
  pendingAction?: "apply" | "revert" | null;
  actionApplied?: boolean;
  createdAt: number;
};

type ConsoleSessionState = {
  sessionId: string;
  messages: ConsoleMessage[];
  fileChangeCount: number;
  hasUncommittedChanges: boolean;
};
```

---

## 5. PIN Gate Design

### 5.1 Flow

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   First visit to /console                                     │
│         │                                                     │
│         ▼                                                     │
│   ┌──────────────────────────────────────────────────┐       │
│   │  🔐 Set your parent PIN                           │       │
│   │                                                   │       │
│   │  This keeps code changes safe. Choose 4 digits:   │       │
│   │  ┌───┐ ┌───┐ ┌───┐ ┌───┐                        │       │
│   │  │ 1 │ │ 2 │ │ 3 │ │ 4 │                        │       │
│   │  └───┘ └───┘ └───┘ └───┘                        │       │
│   │  ┌───┐ ┌───┐ ┌───┐ ┌───┐                        │       │
│   │  │ 5 │ │ 6 │ │ 7 │ │ 8 │                        │       │
│   │  └───┘ └───┘ └───┘ └───┘                        │       │
│   │  ┌───┐ ┌───┐ ┌───┐ ┌───┐                        │       │
│   │  │ 9 │ │ 0 │ │ ← │ │ ✓ │                        │       │
│   │  └───┘ └───┘ └───┘ └───┘                        │       │
│   │                                                   │       │
│   │  [Set PIN]                                        │       │
│   └──────────────────────────────────────────────────┘       │
│         │                                                     │
│         ▼ (subsequent visits)                                 │
│   ┌──────────────────────────────────────────────────┐       │
│   │  🔐 Enter PIN to continue                          │       │
│   │  ┌───┐ ┌───┐ ┌───┐ ┌───┐                        │       │
│   │  │ • │ │ • │ │ • │ │ • │                        │       │
│   │  └───┘ └───┘ └───┘ └───┘                        │       │
│   │                                                   │       │
│   │  Wrong PIN (shakes)    [Forget PIN?]              │       │
│   └──────────────────────────────────────────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 PIN Implementation

- Stored in `localStorage.spark.parentPin` as SHA-256 hash
- Client-side validation only (this is for Ryan, not production auth)
- "Forget PIN" shows a recovery code: "Ask a parent to open browser DevTools and clear `localStorage.spark.parentPin`"
- PIN is sent in request body to `/api/console/chat` for server-side secondary check
- 3 wrong attempts → 30-second cooldown

---

## 6. Diff Display Design

### 6.1 DiffBlock Component

```typescript
// DiffBlock renders a unified diff with syntax highlighting
// Uses diff2html or a lightweight custom renderer

<DiffBlock
  filepath="src/lib/tts-text.ts"
  oldString="export const MAX_CHUNK = 200;"
  newString="export const MAX_CHUNK = 350;"
  onExpand={() => { /* show surrounding context */ }}
/>
```

### 6.2 Visual Design

```
📄 src/lib/tts-text.ts  (+3 −3)

┌───────────────────────────────────────────────────────────┐
│ 40 │ export const MAX_CHUNK = 200;                        │ bg-red/10
│    │ -export const MAX_CHUNK = 200;                       │ text-red
│    │ +export const MAX_CHUNK = 350;                       │ bg-green/10 text-green
│ 41 │                                                      │
│ 42 │ export function chunkForNeuralTts(text: string) {    │
│ 43 │   const chunks = splitIntoSentences(text);           │
│ 44 │ -  return chunks.slice(0, MAX_CHUNK).join(" ");      │
│ 44 │ +  return chunks.join(" ");                          │
│ 45 │                                                      │
│ ...│                                                      │
└───────────────────────────────────────────────────────────┘

[▸ Show 8 more lines]
```

### 6.3 Color Mapping

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Added lines | `#e6f7ef` bg, `#1a7f5a` text | `#1a3a2e` bg, `#4ad1a0` text |
| Removed lines | `#fde8e6` bg, `#c0392b` text | `#3a1a1e` bg, `#f0887a` text |
| Context lines | transparent | transparent |
| Line numbers | `var(--ink-muted)` | `var(--ink-muted)` |
| File header | `var(--mist)` bg | `var(--mist)` bg |

---

## 7. File Structure

```
src/
├── app/
│   ├── console/
│   │   └── page.tsx                        # /console route entry (full console)
│   ├── page.tsx                            # Main Spark page (with embedded MiniConsole)
│   └── api/
│       └── console/
│           └── chat/
│               └── route.ts                # SSE endpoint for builder agent (shared)

├── components/
│   ├── MiniConsoleShell.tsx                # Embedded mini-console panel (slides from sidebar/ bottom sheet)
│   ├── MiniConsoleThread.tsx               # Compact message list for mini-console
│   ├── MiniDiffViewer.tsx                  # Single-file first-hunk diff preview
│   ├── ConsoleShell.tsx                     # Full console orchestrator
│   ├── ConsoleThread.tsx                   # Full message list with diff blocks
│   ├── ConsoleComposer.tsx                 # Multi-line input (text only) for full console
│   ├── DiffViewer.tsx                      # Syntax-highlighted full diffs (multi-file)
│   ├── PinGate.tsx                         # PIN entry + validation (shared by both)
│   ├── TutorShell.tsx                      # Main shell (updated: includes MiniConsole panel)
│   └── HistorySidebar.tsx                  # Sidebar (updated: includes 🛠 link for mini-console)

├── lib/
│   ├── console-harness.ts                 # Builder agent tools
│   ├── console-harness.test.ts            # Console tool tests
│   ├── console-session-store.ts           # Server-side session persistence (shared)
│   ├── console-session-store.test.ts      # Session store tests
│   └── mini-console-store.ts              # Client-side mini-console state (localStorage bridge)

├── types.ts                                # Extended: DiffBlock, ConsoleMessage, MiniConsoleState, etc.

data/
└── console/
    └── sessions/                           # Server-side session JSON files
```

---

## 8. Test Strategy

### 8.1 Unit Tests

| Test File | What It Tests | Count (est.) |
|-----------|---------------|-------------|
| `console-harness.test.ts` | `read_file` (valid/invalid path), `search_code` (regex matches), `edit_file` (unique/non-unique/not-found), `list_files`, `git_diff`, `apply_changes`, `revert_changes`, path traversal prevention, forbidden path blocking | 20+ |
| `console-session-store.test.ts` | Session CRUD, file change tracking, backup rotation | 6+ |
| `mini-console-store.test.ts` | Client-side state bridge, session ID persistence, mini→full state transfer | 4+ |
| `MiniConsoleShell.test.ts` | Panel open/close, SSE streaming (compact), single-turn send, state transitions, "Open full console" link | 8+ |
| `MiniDiffViewer.test.ts` | Single-file first-hunk rendering (±5 lines), has-more indicator, expand trigger | 5+ |
| `DiffViewer.test.ts` | Diff rendering (added/removed/context lines), expand/collapse, empty diff, multi-file | 6+ |
| `PinGate.test.ts` | PIN set/verify/wrong count/timer, recovery UI | 8+ |
| `ConsoleComposer.test.ts` | Text input, Enter send, Shift+Enter newline, disabled state | 5+ |

### 8.2 Integration Tests

| Test File | What It Tests | Count (est.) |
|-----------|---------------|-------------|
| `console/chat/route.test.ts` | SSE streaming, prompt assembly, PIN validation, tool dispatch, error handling, max file change enforcement | 10+ |
| `ConsoleShell.test.ts` | Message rendering, diff approval flow, agent thinking state, error handling | 8+ |

### 8.3 Manual QA Checklist

| Scenario | Device |
|----------|--------|
| First visit → PIN setup → access mini-console from sidebar | Desktop + Phone |
| Type "make font bigger" → mini-console shows thinking → compact diff → apply → verify | Desktop |
| Pinch-to-expand mini diff → "Show full diff" → opens full console | Tablet |
| Click "↗ Open full console" → session context persists | All devices |
| Bad request → agent explains it can't do it | Desktop |
| 3 wrong PIN → cooldown timer | Phone |
| Close mini-console mid-request → reopen → session resumes | Desktop |
| Navigate from full console back to / → regular tutoring works unchanged | All devices |
| Sidebar "Improve Spark" link → opens mini-console panel | Desktop + Tablet |
| Hamburger menu "Improve Spark" → opens mini-console bottom sheet | Phone |

---

## 9. Non-Goals

- It is NOT a general-purpose code editor or IDE
- It is NOT accessible without PIN (after first setup)
- It does NOT auto-deploy changes (restart is manual)
- It does NOT support multi-file refactors in one go within the mini-console (limited to single-file compact diff)
- The mini-console does NOT support multi-turn follow-up questions — "↗ Open full console" for that
- It does NOT support binary file edits
- It does NOT have a "history" or "undo stack" for applied changes (use git)
- It is NOT accessible from the public internet without authentication (same as the main app)

---

## 10. Implementation Map

| Phase | Task | Effort |
|-------|------|--------|
| **A. Core harness** | `console-harness.ts` + tools + safety | 2d |
| **B. Backend** | `/api/console/chat` route + prompt + SSE | 1.5d |
| **C. Mini-Console UI** | `MiniConsoleShell.tsx` + `MiniConsoleThread.tsx` + `MiniDiffViewer.tsx` + sidebar/bottom-sheet integration | 2d |
| **D. Full Console UI** | `ConsoleShell.tsx` + `ConsoleThread.tsx` + `ConsoleComposer.tsx` + `/console` page | 2d |
| **E. Diff UI** | `DiffViewer.tsx` (full) + syntax highlighting | 1d |
| **F. PIN Gate** | `PinGate.tsx` + PIN storage/validation (shared) | 1d |
| **G. Entry Points** | Sidebar link → mini-console; hamburger menu link → mini-console; "↗ Open full console" navigation | 0.5d |
| **H. Session bridge** | Mini ↔ full console session state transfer via `localStorage` + `console-session-store.ts` | 0.5d |
| **I. Testing** | All unit + integration tests (see §8) | 3d |
| **J. QA** | Manual pass on all devices (embedded mini-console + full console) | 0.5d |
| **Total** | | **14d** |

---

## 11. References

- [DESIGN.md](../DESIGN.md) — System architecture overview
- [ui-architecture.md](ui-architecture.md) — Full-page UI design spec
- [security-sanitization.md](security-sanitization.md) — Threat model + safety rules
- [agent-prompt.md](agent-prompt.md) — Existing agent prompt design (for reference)
