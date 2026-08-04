# Streaming Render Stability Fix

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **implemented** · August 2026  
> Fixes: screen flickering during model streaming output

---

## 1. Problem Statement

Users observe the chat screen "flickering" or "refreshing" during model streaming output. The entire message list appears to jump or re-render rapidly, especially on desktop and tablet devices.

### Observable symptoms

1. Message bubbles appear to re-animate (`animate-fade-up`) continuously during streaming
2. The scroll position jitters — content bounces up and down
3. Markdown/KaTeX content flashes as it re-renders
4. The voice (TTS) output stutters or skips
5. iPad devices experience UI freezes during long streaming sessions

### Impact

- Poor readability during streaming — the student cannot follow the tutor's output
- TTS playback interrupted by render stalls
- High CPU usage from unnecessary re-renders

---

## 2. Root Cause Analysis

The flickering is caused by **four interacting issues** in the streaming pipeline:

### 2.1 Excessive `setStore` calls per frame

```
SSE delta (every ~5-50ms)
  → onDelta(text)
    → setStore(prev => upsertActive(prev, { messages: [..., appendDelta] }))
      → React re-renders entire component tree
        → ChatThread re-renders ALL messages
        → MarkdownMessage re-renders and re-parses markdown+KaTeX for every message
```

**File:** `src/components/TutorShell.tsx`, `handleSend` → `onDelta` callback (lines 564-578)

Each SSE delta triggers a full state update via `setStore`. The Cursor SDK emits text deltas at high frequency (often 5-20ms apart per character or word), meaning 50-200 state updates per second. React batches these within the same synchronous scope, but `consumeChatStream` explicitly yields to the browser via `requestAnimationFrame` after each SSE chunk (line 164), creating a new microtask that React cannot batch.

### 2.2 Competing scroll effects

Two separate scroll mechanisms fight for control:

| Location | Mechanism | Trigger |
|----------|-----------|---------|
| `TutorShell.tsx:357-361` | `el.scrollTop = el.scrollHeight` | Every `messages` or `busy` change |
| `ChatThread.tsx:93-97` | `scrollIntoView({ behavior: "smooth" })` | Every `messages` change |

Both fire on every delta update. `scrollTop = scrollHeight` is synchronous and instant, while `scrollIntoView({ behavior: "smooth" })` is animated over ~200ms. When the smooth scroll animation has not completed before the next delta arrives, the next `scrollTop = scrollHeight` forcefully resets the scroll position, causing visible jitter.

### 2.3 Unmemoized message rendering

`MarkdownMessage` is not wrapped in `React.memo`. Every `ChatThread` re-render causes every single `${Memoji}MarkdownMessage` to re-render, even though most messages' content hasn't changed. This is particularly expensive because `MarkdownMessage`:

1. Calls `splitTutorContent()` which does regex splitting on potentially large text
2. Runs `react-markdown` with `remarkGfm`, `remarkMath`, `rehypeKatex` plugins
3. Renders inline KaTeX LaTeX expressions (~20-50ms per message block)

For a chat with 10+ messages, each re-render can take 200-500ms.

### 2.4 CSS animation re-triggering

Each message `<article>` has `className="animate-fade-up"` (line 147). When React re-renders and the key changes (even to the same value), the browser may re-trigger CSS animations depending on how React reconciles the DOM. Combined with the `setStore` calls that create new message objects on every delta, this causes the message list to visually "flash" with repeated fade animations.

---

## 3. Fix Design

### 3.1 Throttle delta → `setStore` to one per animation frame

**File:** `src/components/TutorShell.tsx`

Instead of calling `setStore` on every delta, accumulate deltas within a `requestAnimationFrame` boundary and apply them once per frame.

**Before (simplified):**
```typescript
onDelta: (delta) => {
  setStore((prev) => {
    // ... append delta to assistant message
  });
}
```

**After (simplified):**
```typescript
let pendingDelta = "";
let rafId = 0;

onDelta: (delta) => {
  pendingDelta += delta;
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const batch = pendingDelta;
      pendingDelta = "";
      setStore((prev) => {
        // ... append batch to assistant message
      });
    });
  }
}
```

This reduces state updates from 50-200/sec to 60/sec (matching the display refresh rate), cutting re-renders by 3-8x.

### 3.2 Remove competing scroll effect, use single scroll controller

**Remove** the scroll effect in `TutorShell.tsx` (lines 357-361):
```
// DELETE: this useEffect
useEffect(() => {
  const el = scrollerRef.current;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}, [messages, busy]);
```

**Modify** `ChatThread.tsx` to use `behavior: "instant"` during streaming and throttle scroll calls:

```typescript
useEffect(() => {
  const scrollOnce = () => {
    if (!userScrolled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: streaming ? "instant" : "smooth" });
    }
  };
  let rafId = 0;
  const throttled = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      scrollOnce();
    });
  };
  throttled();
}, [messages, userScrolled, streaming]);
```

This ensures:
- Only one scroll per animation frame
- Instant scroll during streaming (avoids animation overlap)
- Smooth scroll only on message add (not content change)

### 3.3 Memoize `MarkdownMessage` with `React.memo`

```typescript
export const MarkdownMessage = React.memo(function MarkdownMessage({ content, variant }: Props) {
  // ... existing implementation
});
```

This prevents re-rendering of unchanged messages, reducing the rendering cost from O(n) per delta to O(1).

### 3.4 Conditional CSS animation

Remove `animate-fade-up` from messages that already exist. Only apply it to newly added messages:

```typescript
// In ChatThread.tsx, pass an `isNew` flag to each message
const lastMessageId = useRef("");

{messages.map((m) => {
  const isNew = m.id !== lastMessageId.current;
  if (isNew) lastMessageId.current = m.id;
  return (
    <article className={isNew && m.content.length < 100 ? "animate-fade-up" : ""}>
      ...
    </article>
  );
})}
```

---

## 4. Component Interactions (After Fix)

```
SSE delta stream (50-200/sec)
  │
  ▼
consumeChatStream's onDelta callback
  │  accumulates pendingDelta
  │
  ▼  (throttled to 60/sec)
requestAnimationFrame
  │  batch = accumulated deltas
  │
  ▼
setStore → updates ONE message's content
  │
  ▼  (React.memo prevents re-render of other messages)
ChatThread re-render
  │
  ▼  (throttled to 60/sec, instant scroll)
scrollIntoView({ behavior: "instant" })
  │
  ▼
MarkdownMessage (only the last one) re-renders
```

---

## 5. Files Changed

| File | Change | Reason |
|------|--------|--------|
| `src/components/TutorShell.tsx` | Throttle `onDelta` → `setStore` via rAF; remove competing scroll effect | Core fix — reduces re-renders |
| `src/components/ChatThread.tsx` | Throttle scroll, use instant scroll during streaming, conditional animation | Eliminates scroll jitter |
| `src/components/MarkdownMessage.tsx` | Wrap with `React.memo` | Prevents unnecessary re-renders |

---

## 6. Regression Risks

| Risk | Mitigation |
|------|------------|
| TTS streaming may lose fine-grained deltas | TTS `push()` still receives every raw delta; only UI rendering is throttled |
| Final text merge (`onReplace`) may arrive between frames | `onReplace` uses its own `setStore` path, not affected by delimiter throttling |
| `speedApiRef.current.push()` called on every delta | Already uses a ref — no render impact |
| iPad Safari requestAnimationFrame behavior | rAF is well-supported on all target platforms (iOS Safari ≥7, Chrome ≥24) |
| Message dedup/replace edge cases | `onReplace` callback path is separate from `onDelta` path and calls `setStore` directly |
