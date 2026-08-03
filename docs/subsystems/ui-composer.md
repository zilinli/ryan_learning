# Composer UI & Cross-Device Layout

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **spec** (implementation pending) · Version 0.3 · August 2026

---

## 1. Goal

A 9-year-old can **type, snap homework, speak, and send** on:

| Class | Devices |
|-------|---------|
| **Phone** | iPhone (Safari), Huawei phone (Chrome / Huawei Browser / Harmony WebView) |
| **Tablet** | iPad, Huawei MatePad |
| **Desktop** | PC (Chrome / Edge / Safari) |

**UI chrome is English only.** Tutoring replies may still be Cantonese, Mandarin, Spanish, or English (voice + message language).

---

## 2. Current Problems

```
┌─────────────────────────────────────────────┐
│  Ask anything about your homework…          │
│                                             │
│  📎 [拍下题目…] [Hold to talk][Speak off]  │  ← cramped, uneven baseline
│              [Auto · 自动（中文默认粤语）]   │  ← wraps under voice row
│                                    [Send]   │
└─────────────────────────────────────────────┘
```

| Issue | Cause |
|-------|--------|
| Misaligned toolbar | `VoiceControls` is `flex-col` nested inside Composer's single `flex` row |
| Overcrowd | Six actions fight for ~350px: attach, camera, mic, speak, voice select, send |
| Mixed language | Camera CTA + voice labels use Chinese in chrome |
| Breaks minimal UI | Conflicts with “chat + one input”, not a control panel |

---

## 3. Principles

1. **One toolbar row** — textarea above; one action row below; no nested column stacks inside the row.
2. **Photo-first** — camera is the primary homework action; attach stays icon-only.
3. **Progressive disclosure** — voice language picker is secondary; collapse on narrow screens.
4. **English chrome** — buttons, placeholders, `title` / `aria-label`, voice picker labels.
5. **≥44×44px hit targets** on all touch devices.
6. **Physical-tutor test** — if a sitting tutor would not need it, demote or hide it.
7. **One responsive Composer** — width + pointer (`isCoarsePointer`), not UA forks / separate mobile apps.

---

## 4. Device Matrix

| Class | Reference | CSS band | Pointer | Input |
|-------|-----------|----------|---------|-------|
| **Phone** | iPhone SE–16, Huawei Mate / Pura / nova | `< 640px` (`< sm`) | Coarse | Soft keyboard + camera + mic |
| **Tablet** | iPad, MatePad (portrait / landscape) | `640–1023px` | Coarse or fine | Soft or hardware KB |
| **Desktop** | PC browser | `≥ 1024px` (`lg+`) | Fine | Hardware keyboard |

| Signal | Use for |
|--------|---------|
| `min-width` | How many labels fit; camera text vs icon |
| `pointer: coarse` / `isCoarsePointer()` | Hold-to-talk vs tap-to-talk |
| `env(safe-area-inset-*)` | iPhone home indicator; notched Huawei / iPhone |
| `100dvh` / visual viewport | Soft keyboard without covering Send |
| `isSecureContext` | Mic + camera (HTTPS; same for Huawei browsers) |
| Input `font-size ≥ 16px` | Avoid iOS Safari focus zoom |

### Platform notes

| Platform | Design for |
|----------|------------|
| **iPhone** | Safe-area bottom; keyboard shrinks viewport — pin composer above keyboard; TTS unlock only in user gesture (Send / Speak / Mic) |
| **iPad** | More horizontal room → short camera label; fine pointer → hold-to-talk OK; keep large targets for kids |
| **Huawei phone** | Treat as Phone class; safe-area; no `-webkit`-only APIs; camera via `getUserMedia` + file fallback; assume coarse pointer |
| **PC** | Hover OK; Enter = send, Shift+Enter = newline; full English labels; inline voice `<select>` |

---

## 5. Target Layouts

### 5.1 Phone (iPhone / Huawei) — primary

**Never wrap** the action row. Collapse voice settings.

```
┌──────────────────────────────────────┐
│  Ask anything about your homework…   │
│                                      │
│  📎   📷 Photo    🎤    🔊    ➤     │
│ attach  camera   mic  speak  send    │
└──────────────────────────────────────┘
         hints / status below card
```

| Control | Presentation | Notes |
|---------|--------------|-------|
| Attach | Icon only | `title="Upload file"` |
| Camera | Icon + **Photo** | Opens `CameraCapture` |
| Mic | Icon or **Mic** | Tap-to-talk (coarse): record → tap again to send |
| Speak | Icon toggle | TTS on/off; opens voice menu (long-press or chevron) |
| Voice select | **Not inline** — sheet / popover | English options (§6) |
| Send | Teal pill / circle | Disabled until text or attachment |

### 5.2 Tablet (iPad / MatePad)

```
┌────────────────────────────────────────────────────┐
│  Ask anything about your homework…                 │
│                                                    │
│  📎  📷 Snap homework   🎤 Hold to talk  🔊  ➤    │
└────────────────────────────────────────────────────┘
```

| Delta vs phone | Spec |
|----------------|------|
| Camera | **Snap homework** |
| Mic | **Hold to talk** if fine pointer; **Mic** if coarse |
| Speak | Text OK when width ≥ ~700px |
| Voice | Compact `<select>` or same popover — must not force a second row |

### 5.3 Desktop (PC)

```
┌──────────────────────────────────────────────────────────────┐
│  Ask anything about your homework…                           │
│                                                              │
│  📎  📷 Snap homework   Hold to talk  Speak on  [Auto ▾] ➤ │
└──────────────────────────────────────────────────────────────┘
```

| Delta vs tablet | Spec |
|-----------------|------|
| Labels | All primary actions show English text |
| Voice `<select>` | Inline; max-width capped so Send never wraps |
| Keyboard | Enter send / Shift+Enter newline |
| Hover | Mist background on icon buttons |

---

## 6. English Chrome Copy

| Element | Copy |
|---------|------|
| Placeholder | `Ask anything about your homework…` |
| Attach | `Upload file` |
| Camera (phone) | `Photo` |
| Camera (tablet / desktop) | `Snap homework` |
| Camera `title` | `Take a photo of your homework` |
| Mic (hold) | `Hold to talk` |
| Mic (tap) | `Mic` → `Tap to send` while recording |
| Speak | `Speak on` / `Speak off` / `Speaking…` |
| Send | `Send` / `Thinking…` |
| Voice auto | `Auto · Chinese defaults to Cantonese` |
| Ava | `Ava · English ♀` |
| Ryan | `Ryan · English ♂` |
| Yunxi | `Yunxi · Mandarin ♂` |
| WanLung | `WanLung · Cantonese ♂` |
| Álvaro | `Álvaro · Español ♂` |
| Jorge | `Jorge · Español MX ♂` |
| Hints | `Replies in Cantonese` / `Replies in Mandarin` / `Auto: match language (Chinese → Cantonese)` |

**Keep multilingual (not chrome):** agent prompts, TTS preview utterances, skill regexes, STT language codes, struggle-phrase detection.

---

## 7. Component Structure

```
Composer
├── attachment chips (above card)
├── card
│   ├── textarea
│   └── toolbar   ← single flex row, items-center, flex-nowrap
│       ├── attach
│       ├── camera
│       ├── VoiceControls (inline — NOT flex-col)
│       │   ├── mic
│       │   ├── speak
│       │   └── voiceSelect | VoiceMenu
│       ├── spacer (flex-1 min-w-0)
│       └── send
└── status / error / hint (below card)
```

Rules:

- `VoiceControls` must not introduce a column that breaks the toolbar baseline.
- Prefer `flex-nowrap` + menu over `flex-wrap`.
- Every control: `min-h-11 min-w-11` (2.75rem).

---

## 8. Responsive Summary

| Concern | Phone | Tablet | PC |
|---------|-------|--------|-----|
| Camera label | `Photo` | `Snap homework` | `Snap homework` |
| Mic mode | Tap-to-talk | Hold if fine pointer | Hold-to-talk |
| Speak | Icon | Icon or short text | Text |
| Voice picker | Popover / sheet | Compact select or popover | Inline select |
| Toolbar wrap | **Forbidden** | Avoid | Avoid |
| Safe-area | Required | Landscape notch cases | N/A |
| Input font | ≥16px | ≥16px | inherit OK |

---

## 9. Acceptance Criteria

Linked from TODO **0.8–0.10**:

- [ ] **0.8a** — `VoiceControls` flattened; status/hints below composer
- [ ] **0.8b** — Phone 390×844: one row; camera `Photo`; voice in popover; 44px targets
- [ ] **0.8c** — Tablet 768×1024: `Snap homework`; hold vs tap by pointer
- [ ] **0.8d** — Desktop ≥1024: full labels + inline voice; Enter sends
- [ ] **0.9a/b** — All chrome English (voices + actions + hints)
- [ ] **0.10a** — QA: iPhone 14 (390×844) + Huawei (360×780); keyboard-open safe-area; TTS gesture-gated
- [ ] **0.10b** — QA: iPad (768/1024) + PC (1280×800)

Also:

- [ ] Camera works; attach remains fallback if permission denied
- [ ] Soft keyboard (iOS / Huawei): Send not covered by home indicator (`safe-bottom`)

---

## 10. Implementation Map

| File | Change |
|------|--------|
| `src/components/Composer.tsx` | Toolbar layout; English camera copy |
| `src/components/VoiceControls.tsx` | Flatten to inline; English hints; phone voice menu |
| `src/lib/voices.ts` | English `label` strings |
| `src/app/globals.css` | Safe-area / composer helpers if needed |
| `src/lib/voices.test.ts` | Update label assertions |

Related: [voice-tts-stt.md](voice-tts-stt.md) · [synthesis.md](../synthesis.md) · [TODO.md](../TODO.md)

---

## 11. Non-Goals

- Full settings page or voice dashboard
- Separate mobile vs desktop React trees
- Localizing chrome into Chinese (tutoring language ≠ UI language)
- Changing BKT / agent pedagogy in this pass
