# 🎨 UI Architecture & Cross-Device Design

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **spec** (implementation pending) · August 2026  
> Supersedes: [ui-composer.md](ui-composer.md) (merged into §4)

---

## 1. Design Philosophy

```
┌─────────────────────────────────────────────────────────┐
│  What Ryan Sees                     What Spark Does     │
│  ┌───────────────────┐              (invisible)         │
│  │  ☰ Spark · Ryan 🔊│              ┌──────────────┐   │
│  │───────────────────│              │ Language det. │   │
│  │                   │              │ LaTeX render  │   │
│  │   Chat messages   │              │ Diagram fix   │   │
│  │   (large type)    │              │ TTS synth     │   │
│  │                   │              │ BKT update    │   │
│  │───────────────────│              │ Sync          │   │
│  │ 📎 📷 🎤 🔊  ➤   │              └──────────────┘   │
│  └───────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

**Core rule:** What Ryan sees is the minimum viable tutor UI. Everything else is invisible automation.

### Design Principles

1. **Physical Tutor Test** — "Would a tutor sitting next to Ryan need this UI element?" If not, cut it.
2. **One action per interaction** — click = one thing. No drill-downs, no nested menus.
3. **44×44px minimum** — Apple HIG + Android Material: every interactive control ≥44dp.
4. **English chrome, multilingual content** — UI labels are English; agent replies follow student language.
5. **Mobile-first, progressive enhancement** — design for 360px phone first; add richness at wider widths.
6. **Zero cognitive noise** — no dashboards, badges, notifications, or feature flags visible to child.

---

## 2. Reference Products & Inspirations

| Product | Key UX Pattern Adopted |
|---------|----------------------|
| **豆包爱学** (ByteDance) | Photo-first: camera is the primary action; guided problem-solving over direct answers; desktop+phone+tablet apps with unified chat |
| **Khanmigo** (Khan Academy) | Socratic interface; clean layouts, big buttons; AI integrated into existing flow; "no cheating" constraint as UX feature |
| **Pok Pok** (Apple Design Award) | Montessori minimalism: no confusing menus, no overstimulating colors, calming palette, zero-instruction discovery |
| **Khan Academy** | Mastery system, WCAG 2.2 accessible colors, clear progress without overwhelming learner |

### Key Architectural References

| Technology | Role |
|-----------|------|
| **shadcn/ui** | Component primitives (Button, Avatar, Separator, Dialog) — already used |
| **Vercel AI Elements** | `Conversation`, `Message`, `PromptInput` — prebuilt streaming-optimized chat components. Reference design patterns for message parts, reasoning display, tool call rendering |
| **Tailwind CSS 4** | Responsive grid, `pointer:coarse` queries, `env(safe-area-inset-*)`, `100dvh` |
| **Lucide Icons** | Consistent 24px icon set — already used |
| **Geist Sans / PingFang SC** | Font stack: Geist for UI, PingFang for CJK — already configured |

---

## 3. Device Matrix

Target devices Ryan & family actually use:

| Class | Devices | Width Band | Input | Pointer | Font Scale |
|-------|---------|------------|-------|---------|------------|
| **Phone** | iPhone SE/14/15/16, Huawei Mate/Pura/nova | 360–430px (`< sm`) | Soft KB + mic + camera | Coarse (finger) | 16px min on input |
| **Tablet** | iPad (portrait/landscape), Huawei MatePad | 640–1023px (`sm`–`lg`) | Soft KB or hardware | Mixed (finger + mouse) | 18px chat |
| **Desktop** | PC Chrome/Edge/Safari | ≥1024px (`lg+`) | Hardware KB + mouse | Fine | Inherit |

### Responsive Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Single React tree                          │
│                                                              │
│  Composers.tsx ─── width-based tailwind breakpoints           │
│                ─── pointer:coarse detection                   │
│                ─── env(safe-area-inset-*)                     │
│                ─── 100dvh for keyboard-aware height            │
│                                                              │
│  NO separate mobile/desktop trees                             │
│  NO user-agent sniffing                                       │
│  NO platform-specific components                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture

### 4.1 Shell Layout (TutorShell.tsx)

```
┌─────────────────────────────────────────────┐
│ header (48px, shrink-0)                      │
│ ┌─────────────────────────────────────────┐ │
│ │ ☰  Spark · Ryan    🔊    ☀/🌙          │ │
│ │ hamburger  brand   speak  dark-mode     │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ sidebar (overlay, ~300px, translateX)        │
│ ┌─────────────────────────────────────────┐ │
│ │ New chat + Search                        │ │
│ │ Recent chats list  ← flex-1, primary     │ │
│ │ SkillsPanel strip  ← collapsed, bottom   │ │
│ │ Code Agent / GitHub                      │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ main (flex-1, overflow-y-auto)               │
│ ┌─────────────────────────────────────────┐ │
│ │ ChatThread — message bubbles             │ │
│ │ ┌─────────────────────────────┐          │ │
│ │ │ student message (right)     │          │ │
│ │ └─────────────────────────────┘          │ │
│ │ ┌──────────────────────────┐             │ │
│ │ │ agent message (left)     │             │ │
│ │ │ with LaTeX, diagrams     │             │ │
│ │ └──────────────────────────┘             │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ status bar (shrink-0)                        │
│ "Thinking…" / error text                    │
├─────────────────────────────────────────────┤
│ composer (shrink-0, bordered-top, bg-blur)   │
│ ┌─────────────────────────────────────────┐ │
│ │ attachment chips (when present)          │ │
│ │ ┌─────────────────────────────────────┐ │ │
│ │ │ textarea (auto-expand 1→4 rows)     │ │ │
│ │ │ "Ask anything about your homework…" │ │ │
│ │ └─────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────┐ │ │
│ │ │ toolbar (single flex-row, no wrap)  │ │ │
│ │ │ 📎   📷 Photo   🎤   🔊   [voice]   ➤│ │ │
│ │ │ attach camera   mic speak voice-sel send│ │ │
│ │ └─────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 4.2 Composer Toolbar — Per-Device

**Phone (360–430px):**
```
📎  📷 Photo   🎤  🔊  ➤
```
- Attach: icon-only, `title="Upload file"`
- Camera: `Photo` label (English)
- Mic: icon, tap-to-talk on coarse pointer
- Speak: icon toggle, long-press for voice menu popover
- Voice select: NOT inline — popover/sheet
- Send: teal pill, disabled until content

**Tablet (640–1023px):**
```
📎  📷 Snap homework   Hold to talk  🔊  [Auto ▾]  ➤
```
- Camera: `Snap homework` label
- Mic: `Hold to talk` when fine pointer; `Mic` when coarse
- Speak: icon + short text if ≥700px width
- Voice: compact `<select>` or popover (must not force wrap)

**Desktop (≥1024px):**
```
📎  📷 Snap homework   Hold to talk  Speak on  [Auto · Canto ▾]  ➤
```
- All text labels visible
- Voice `<select>` inline, English options
- Hover: subtle bg on icon buttons
- Enter send / Shift+Enter newline

### 4.3 Color System

```
┌──────────────────────────────────────────────┐
│ LIGHT MODE (default)                         │
│                                              │
│  --bg0:     #f3faf8  (mint-white background)  │
│  --bg1:     #dceef5  (blue atmosphere blob)   │
│  --bg2:     #e8f6ef  (green atmosphere blob)  │
│  --ink:     #12323a  (dark teal text)         │
│  --ink-muted: #5d7680 (secondary text)        │
│  --teal:    #1f8a7f  (primary accent)         │
│  --coral:   #e06b5c  (error/warning)          │
│  --mist:    #e7f3f1  (subtle bg)              │
│  --line:    rgba(18,50,58,0.12) (borders)    │
│                                              │
│  Cards:     white/90 + shadow + backdrop-blur  │
│  Chat bubbles: mist bg for agent, teal for user│
│                                              │
│ DARK MODE (html.dark)                         │
│  --bg0:     #0f1a1e  (dark navy bg)           │
│  --teal:    #4ad1c0  (brighter accent)        │
│  --coral:   #f0887a  (softer error)           │
└──────────────────────────────────────────────┘
```

### 4.4 Typography Scale

| Element | Phone | Desktop | Weight |
|---------|-------|---------|--------|
| Brand header | 17px | 18px | 600 |
| Chat message body | 16px | 17px | 400 |
| Chat message meta | 12px | 12px | 400 |
| Textarea input | 16px (min) | Inherit | 400 |
| Composer labels | 12px | 13px | 500 |
| Skills panel | 13px | 14px | 400 |
| Error text | 14px | 14px | 500 |
| Status hints | 12px | 12px | 400 |

Font stack: `Geist Sans → PingFang SC → Hiragino Sans GB → Noto Sans SC → Microsoft YaHei → sans-serif`

### 4.5 Spacing & Hit Targets

| Element | Min Size | Rationale |
|---------|----------|-----------|
| All icon buttons | 44×44px | Apple HIG + Android Material |
| Textarea | 44px min-height | iOS keyboard-friendly |
| Send button | 44×44px | Always reachable thumb-zone |
| Hamburger menu | 48px wide | Easy thumb access |
| Message bubble padding | 12px 16px | Readable for young eyes |
| Sidebar width | 300px max | Doesn't crowd main content |

---

## 5. Component Specifications

### 5.1 TutorShell Header (48px)

**States:** default, sidebar-open, voice-active, dark-mode

```
┌─────────────────────────────────────────────────────────┐
│ ☰    ✨ Spark · Ryan                            🔊  ☀  │
│ 48px  18px brand, tracking-wide                         │
└─────────────────────────────────────────────────────────┘
```

**Props/State:**
- `sidebarOpen: boolean` → controls hamburger icon (three-lines → X)
- `voiceEnabled: boolean` → speak icon fill (teal/10 vs muted)
- `dark: boolean` → sun/moon icon swap

**Implementation notes:**
- Hamburger: `<button aria-label="Menu">` with 3-line SVG, trasnforms to X on open
- Brand: click returns to root (`/`), resets to empty chat
- Speak toggle: quick-access for TTS on/off
- DarkMode: persists to `localStorage.spark.dark` (implemented)

### 5.2 ChatThread (scrollable area)

**Requirements:**
- Auto-scroll to bottom on new messages (with stick-to-bottom UX)
- Manual scroll-up disables auto-scroll; "↓ New messages" badge to resume
- Message grouping: consecutive messages from same role by avatar only on first
- Loading skeleton while agent is "thinking"

**Message Bubble Layout:**
```
User (student):                 Agent (tutor):
┌──────────────────┐           ┌────────────────────────────┐
│ "How do I solve   │           │ Let's look at this step by  │
│  this fraction    │           │ step. First, what's common  │
│  problem?"        │           │ between 1/2 and 1/4?       │
└──────────────────┘           │                            │
        right                  │ ┌────────────────────────┐ │
                               │ │ bar model diagram      │ │
                               │ │ [figure SVG]           │ │
                               │ └────────────────────────┘ │
                               └────────────────────────────┘
                                       left
```

### 5.3 MarkdownMessage (message renderer)

**Responsibilities:**
- Renders markdown via `react-markdown` for non-diagram content
- Splits and renders SVG/Mermaid diagrams as `<img>` tags
- Renders LaTeX via KaTeX
- Handles streaming: partial markdown → incremental render
- Strips agent tool narration (`tutor-text-filter.ts`)
- Supports `~~~step` progressive disclosure fences

### 5.4 HistorySidebar (overlay, ~28rem / 88vw)

**States:** closed (translateX:-100%), open (translateX:0)

**Vertical order (top → bottom) — chat-first:**
1. **Header:** brand + close (mobile)
2. **New Chat button:** prominent
3. **Search:** "Search chats…" — **16px** input text
4. **Conversation list:** `flex-1 min-h-0 overflow-y-auto` — the primary surface
   - Title **16px**; snippet/meta **12px**; comfortable row padding
   - Active conversation: highlighted
   - Hover/tap: delete affordance
5. **SkillsPanel:** collapsed strip above footer (see §5.5)
6. **Footer (compact grids):**
   - `Family | Me | Progress`
   - `Studio | Games | Dict`
   - `GitHub | Help & feedback`
   - `Code Agent` (full width)

**Anti-pattern (fixed Aug 2026):** Do **not** place an expanded Learning Dashboard above New chat / history. That pushes the conversation list off-screen and violates “zero cognitive noise.”

**Density (Aug 2026):** Do **not** give Progress or Dictionary a dedicated full-width row — see [sidebar-density.md](sidebar-density.md).

### 5.5 SkillsPanel (sidebar subsection — collapsible)

**Default:** collapsed to a **single summary row** (~36px). Expanded only on explicit tap/click.

```
Collapsed (default):
┌────────────────────────────────────┐
│ ▸ Learning · Try: fractions · 3 focus │
└────────────────────────────────────┘

Expanded (on tap, max ~40% of sidebar height, own scroll):
┌────────────────────────────────────┐
│ ▾ Learning · BKT + SM-2            │
│ Today's challenge: Equivalent Frac │
│ Stronger (≤2) · Focus (≤2)         │
│ Parent PIN status                  │
└────────────────────────────────────┘
```

**Collapsed row shows:**
- Chevron + "Learning"
- One ZPD hint (truncated) if available
- Focus-count badge if weak skills exist

**Expanded content (trimmed vs. full dashboard):**
- Single ZPD "Today's challenge" line (no topic overview pills)
- Stronger ≤2, Focus ≤2 (no review-needed block by default — keep density low)
- Parent PIN status footer

**Layout rules:**
- Lives **below** the chat list, above Code Agent footer
- `shrink-0` when collapsed; when expanded use `max-h-[40%]` + internal scroll so history stays browsable
- Persist expand state in `sessionStorage` key `spark.skillsPanelOpen` (session only — default closed on fresh load)

**Design rule:** BKT data is for the agent/parent, not the child’s primary view. Always behind a toggle; never compete with chat history for vertical space.

### 5.6 VoiceControls (embedded in Composer toolbar)

**Current problem:** `VoiceControls` renders as a `flex-col` insider one row, causing uneven baseline and wrapping.

**Target:** VoiceControls must be a **fragment** (not a flex-col wrapper). Its children (mic, speak, voice-select) are inline siblings in the parent toolbar.

```tsx
// VoiceControls returns inline content, no wrapper div:
<>
  <MicButton />
  <SpeakToggle />
  <VoiceSelect />  {/* responsive: popover on phone, select on desktop */}
</>
```

**Per-device behavior:**
- Phone: tap-to-talk mic, speak icon toggle, voice picker in popover
- Tablet: hold-to-talk (fine pointer) or tap-to-talk (coarse)
- Desktop: hold-to-talk mic, speak text toggle, voice `<select>` inline

### 5.7 Composer (input area)

**Full spec** inherited from [ui-composer.md](ui-composer.md) §5–8. This document extends to cover the full page, not just the input chrome.

---

## 6. Responsive Behavior Matrix

| Concern | Phone (360–430px) | Tablet (640–1023px) | Desktop (≥1024px) |
|---------|-------------------|---------------------|-------------------|
| **Header height** | 48px | 48px | 48px |
| **Brand text** | "Spark · Ryan" (17px) | "Spark · Ryan" (18px) | "Spark · Ryan" (18px) |
| **Sidebar** | Full-screen overlay | Partial overlay (300px) | Slide-in panel (300px) |
| **Chat area max-w** | Full width | max-w-2xl (672px) | max-w-2xl (672px) |
| **Message font** | 16px | 16px | 17px |
| **Composer toolbar** | 1 row, no wrap | 1 row, short labels | 1 row, full labels |
| **Camera label** | `Photo` | `Snap homework` | `Snap homework` |
| **Mic interaction** | Tap-to-talk | Hold (fine ptr) / Tap (coarse) | Hold-to-talk |
| **Speak control** | Icon toggle | Icon + short text | `Speak on/off` text |
| **Voice picker** | Popover/sheet | Compact select or popover | Inline `<select>` |
| **Send button** | `➤` icon pill | `➤` icon pill | `➤` icon pill |
| **Safe-area** | `safe-bottom` required | Required (portrait notched) | N/A |
| **Keyboard behavior** | `100dvh`, pinned above KB | `100dvh` on soft KB | Static |

---

## 7. States & Edge Cases

### 7.1 Loading
- Initial: empty state with large placeholder "Ask anything about your homework…"
- Chat loading: skeleton placeholder pulse for agent message
- TTS loading: speak icon shows subtle pulse while audio buffer fills

### 7.2 Empty
- No conversations: sidebar shows "No conversations yet — start chatting!"
- Empty textarea: send button disabled (gray, no teal)
- No photos: camera button remains visible, opens capture UI

### 7.3 Error
- Network error: toast/banner "Connection lost — tap to retry"
- TTS error: speak icon turns coral, tooltip "Audio unavailable"
- STT error: mic icon shows subtle shake animation, tooltip
- Agent timeout: "Taking longer than usual…" status above composer

### 7.4 Photo/Camera
- Camera permission denied: show file picker as fallback
- Camera open: full-screen modal with capture button
- Photo upload progress: attachment chip shows spinner
- Oversized image: auto-resize before upload

### 7.5 Voice
- TTS queued: speak icon pulse animation
- TTS speaking: speak icon solid teal
- TTS off: speak icon muted gray
- Mic recording: mic ring animation (red pulsing border)
- Mic processing: "Listening…" status below composer

---

## 8. Accessibility (WCAG 2.2 AA Target)

| Requirement | Implementation |
|-------------|---------------|
| Color contrast ≥4.5:1 | `--ink: #12323a` on `#f3faf8` = 9.2:1 ✅ |
| Focus visible | `focus-visible:ring-2 ring-[--teal]` on all interactive |
| Screen reader | `aria-label` on icon buttons; `role="alert"` on errors |
| Keyboard nav | Tab order: header → main → composer; Esc closes sidebar |
| Touch targets | 44×44px minimum on all interactive elements |
| Reduced motion | `prefers-reduced-motion` disables pulse/ripple animations |
| Font scaling | `rem` units throughout; textarea min 16px |

---

## 9. Performance Budget

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | <2.5s |
| TBT (Total Blocking Time) | <200ms |
| CLS (Cumulative Layout Shift) | <0.1 (keyboard open) |
| Chat render frame budget | 16ms (60fps scroll) |
| Sidebar open transition | <200ms |
| Photo upload → chip visible | <500ms |

---

## 10. Animation Guidelines

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Sidebar open/close | `translateX` slide | 250ms | ease-out |
| Message appear | `fade-up` (opacity + translateY) | 200ms | ease-out |
| Attachment chip add | `scale-in` | 150ms | ease-out |
| Mic recording ring | `pulse-ring` (scale + opacity) | 1s | infinite |
| Speak icon pulse | `opacity-pulse` | 1.5s | infinite |
| Toolbar wrap → menu | (none) — width-based swap, no animation | — | — |

**Reduced motion:** All animations respect `prefers-reduced-motion: reduce`.

---

## 11. Implementation Map

| Phase | Task | Target Files | Effort |
|-------|------|-------------|--------|
| **A. Composer layout** | Flatten VoiceControls, responsive toolbar, English labels | `Composer.tsx`, `VoiceControls.tsx`, `voices.ts` | 2d |
| **B. Shell polish** | Sidebar slide animation, empty states, error banners, keyboard shortcut hints | `TutorShell.tsx`, `HistorySidebar.tsx` | 1d |
| **C. Chat bubbles** | Left/right alignment, auto-scroll, "new messages" badge, loading skeleton | `ChatThread.tsx`, `MarkdownMessage.tsx` | 1d |
| **D. Accessibility** | `aria-label`, focus-visible rings, keyboard nav, screen-reader tests | All `.tsx` files | 1d |
| **E. Motion** | Reduce animations, fade-up messages, sidebar transition | `globals.css`, `tailwind.config` | 0.5d |
| **F. Device QA** | Manual pass on all 4 device classes | Manual | 0.5d |
| **Total** | | | **6d** |

---

## 12. Non-Goals (out of scope)

- Dedicated mobile apps (React Native / iOS / Android)
- RTL language support (Chinese LTR, English LTR — no RTL needed yet)
- Drag-and-drop file upload (click-to-upload is sufficient for kids)
- Settings page beyond dark mode + voice
- Multi-user / classroom / teacher dashboard
- A/B testing framework
- Analytics / telemetry dashboard
