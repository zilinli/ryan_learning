# Competitive UI Design — 竞品功能界面细节规格

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **spec + UI-POLISH shipped** · August 2026 · gap checklist §12 implemented (UI-P1 deferred)  

> Product plan: [competitive-product-plan-v2.md](competitive-product-plan-v2.md)  
> Shell rules: [ui-architecture.md](ui-architecture.md) · P0 systems: [ca-p0-system-design.md](ca-p0-system-design.md)  
> Downstream: [TODO.md § UI Spec](../TODO.md)

---

## 0. North star & tokens

**Physical tutor test · chat-first · 44×44px min · English chrome · zero child dashboard.**

| Token / rule | Use |
|--------------|-----|
| `--action-bg` / `--action-ink` | Primary CTA |
| `--teal` | Speaking / focus ring |
| `--coral` | Listening / interrupt emphasis |
| `--ink` / `--ink-muted` | Body / secondary |
| `--surface-muted` / `--line` | Cards, chips |
| `min-h-11` (44px) | All tappable controls |
| Fade 150–200ms | Card appear/dismiss |
| Max 1 decorative emoji | Empty-state hero only |

**No new nav tabs.** Competitive features attach to chat column or PIN-gated sidebar only.

---

## 1. Industry references

| Ref | Steal | Reject |
|-----|-------|--------|
| **QANDA** | Warm one-line empty state; camera as primary affordance; pill chips; no illustration pile | Answer-wall / search results UI |
| **Riiid** | Question-form empty headline; one primary CTA per section; light surfaces | High-saturation gamification |
| **Pok Pok** | Low stimulation, large targets, few menus | Badge walls |
| **Khanmigo** | Socratic in the content stream; progress stays quiet | Course-catalog home |
| **Claude / ChatGPT empty** | Centered welcome + 2–3 suggestions; composer always reachable | Marketing multi-column |
| **Voice barge-in norms** | Clear speaking → listening handoff | Full-screen voice orb (noisy kid homes) |
| **iMessage / WhatsApp** | Mic stays put; state changes color/label only | Mic icon jumping when text appears |

---

## 2. Global shell (TutorShell)

### Current code

[`TutorShell.tsx`](../../src/components/TutorShell.tsx): header (menu, speak, theme, account) → scrollable chat → composer strip. Sidebar: history + collapsible [`SkillsPanel.tsx`](../../src/components/SkillsPanel.tsx) (Learning strip). Code Agent is separate panel.

### Industry pattern

QANDA / chat tutors: single conversation column; secondary tools in rail; never steal first viewport from chat.

### Spark target wireframe

**Phone 360**

```
┌─────────────────────────────┐
│ ☰  Spark · Ryan        🔊 🎨│
├─────────────────────────────┤
│                             │
│     (chat / empty)          │
│                             │
├─────────────────────────────┤
│ [status hint if speaking]   │
│ 📎 📷  🎤  🔊  [voice]  ➤   │
└─────────────────────────────┘
```

**Desktop ≥1024**

```
┌──────── sidebar ────────┬────────── main ──────────┐
│ New chat / search       │ header                   │
│ chat list (flex-1)      │ chat column max-w-2xl    │
│ ▸ Learning strip        │ composer                 │
│ Code Agent footer       │                          │
└─────────────────────────┴──────────────────────────┘
```

### States / copy / a11y

- Sidebar Learning strip collapsed by default (`sessionStorage spark.skillsPanelOpen`).
- Competitive CTAs never appear as top-level routes.

### Acceptance

- [ ] No new tab/route for A1–D2  
- [ ] Chat list remains flex-1 above Learning strip  
- [ ] Lightbox z-index > progress chip (see image-lightbox-zoom)

---

## 3. Empty chat

### Current code

[`ChatThread.tsx`](../../src/components/ChatThread.tsx) when `messages.length === 0`:

- Hero 📚 + “Ask anything about your homework...”  
- Supporting line + non-interactive Photo / Voice **pills**  
- Conditional card: **practiceOffer** else **sessionOpener**

Composer remains mounted below (TutorShell) — good (QANDA pattern).

### Industry pattern

Actionable empty state: headline + short help + real CTAs; decorative chips that look tappable but aren’t are an anti-pattern.

### Spark target wireframe

```
┌──────────────────────────────┐
│            📚                │
│  Ask anything about your     │
│  homework...                 │
│  Snap a photo, type, or mic. │
│  I'll guide you — no spoilers│
│                              │
│  [ Snap homework ]  ← real   │
│  (opens camera)              │
│                              │
│  ┌─ optional one card ─────┐ │
│  │ Practice / Opener        │ │
│  └──────────────────────────┘ │
└──────────────────────────────┘
     composer always visible ↓
```

### States / copy / a11y

| Priority | Surface |
|----------|---------|
| 1 | Practice card (A2) |
| 2 | Opener card (B1) |
| 3 | Bare empty |

- Replace decorative pills with **one** tappable “Snap homework” (or keep pills as plain text labels, not bordered faux-buttons).  
- Max one hero emoji.  
- Card dismiss: fade 150–200ms.

### Acceptance

- [ ] No faux-button pills  
- [ ] At most one offer card  
- [ ] Composer reachable without scrolling on 390×844  

---

## 4. A1 — Worksheet progress chip

### Current code

Sticky centered pill: `Question N of T` via `formatProgressLabel`; `aria-live="polite"`. Not expandable. Fence stripped from message body.

### Industry pattern

Khanmigo / worksheet apps: quiet progress; optional expand for list — never a full homework manager.

### Spark target wireframe

**Collapsed (default)**

```
        ┌──────────────────┐
        │ Question 2 of 8  │  ← tap to expand
        └──────────────────┘
```

**Expanded (≤40vh)**

```
┌─────────────────────────────┐
│ Question 2 of 8          ▴  │
│ • Q1  done                  │
│ • Q2  active ←              │
│ • Q3  pending               │
│ …                           │
└─────────────────────────────┘
```

**Complete**

```
│ All done · 8 questions │  → fade out after 3s
```

### States / copy / a11y

| State | UI |
|-------|-----|
| no plan | not rendered |
| active | chip + optional list |
| all done | “All done · N questions” then hide |
| streaming | chip updates when fence merges |

- `aria-expanded` on chip button when expandable  
- z-index below lightbox (`z-[200]`)  
- List: label + status dot only (no scores)

### Acceptance

- [ ] Tap expands checklist ≤40vh  
- [ ] Default shows current item only  
- [ ] All-done auto-dismiss 3s  
- [ ] Does not occlude message bubbles on phone  

---

## 5. A2 — Practice 3 card

### Current code

Card: “Practice 3 quick ones?” + skill labels + Let’s practice / Tomorrow / Dismiss. Kickoff via `buildPracticeKickoffMessage`.

### Industry pattern

Riiid / Socra: one clear primary; soft decline; no nag after refuse.

### Spark target wireframe

```
┌────────────────────────────────────┐
│ Practice 3 quick ones?             │
│ Fraction concepts · Place value    │
│                                    │
│ [ Let's practice ]  primary        │
│ [ Tomorrow ]        outline        │
│ Dismiss             text link      │
└────────────────────────────────────┘
```

### States / copy / a11y

| Action | Behavior |
|--------|----------|
| Let’s practice | send kickoff; clear offer; mark opener shown |
| Tomorrow | defer until next local day |
| Dismiss | clear offer; **same calendar day: do not show again** |

- Skills: max 3, single line, `truncate`  
- Priority over B1 opener  

### Acceptance

- [ ] Primary ≥44px  
- [ ] Dismiss/Tomorrow → no re-show same day  
- [ ] Labels truncated without wrapping past 2 lines  

---

## 6. B1 — Session opener card

### Current code

Line: `Today fits {label} — or snap homework first?`  
Buttons: `Try {label}` / `Snap homework` (Snap only dismisses opener today — **does not open camera**).

### Industry pattern

QANDA empty: camera is a real primary action.

### Spark target wireframe

```
┌────────────────────────────────────┐
│ Today fits Fraction concepts —     │
│ or snap homework first?            │
│                                    │
│ [ Try Fraction concepts ] primary  │
│ [ Snap homework ]         outline  │
└────────────────────────────────────┘
```

### States / copy / a11y

| Action | Behavior |
|--------|----------|
| Try {label} | kickoff message; `markOpenerShown` |
| Snap homework | `markOpenerShown` + **trigger Composer camera** |

- Empty-state opener = once/day active offer; SkillsPanel “Try: …” = passive summary only  

### Acceptance

- [ ] Fixed English copy template  
- [ ] Snap homework opens camera (spec; implement later)  
- [ ] Hidden when practice card present  

---

## 7. B2a — TTS barge-in (inline mic)

### Current code

[`VoiceControls.tsx`](../../src/components/VoiceControls.tsx): `startListening` stops TTS (`planBargeIn`). Speaking changes Speak-toggle label; **mic look almost unchanged** — interrupt only via `title` / `aria-label`.

### Industry pattern

Voice UIs: explicit speaking → listening handoff; mic position stable (WhatsApp). No full-screen orb for G4 homework at kitchen table.

### Spark target state machine

```
idle → speaking → (tap mic) → listening → idle
         │
         └─ hint: "Speaking — tap mic to interrupt"
```

**Visual target**

| State | Mic |
|-------|-----|
| idle | mist / muted |
| speaking | teal ring + pulse; aria includes interrupt |
| listening | coral fill (existing) |
| busy/transcribe | teal “…” |

Status row above composer (English):

```
Speaking — tap mic to interrupt
```

### States / copy / a11y

- 4.1a only — no continuous VAD (B2b later)  
- Mic **does not move** when text is in the input  

### Acceptance

- [ ] Visible speaking treatment on mic (not tooltip-only)  
- [ ] Status line when `speaking`  
- [ ] Tap mic stops TTS within one frame of `stop()`  
- [ ] Manual M4 on live  

---

## 8. D2 — Parent daily one-liner (P2)

### Current code

[`PinUps`](../../src/components/PinGate.tsx) + SkillsPanel shows “Parent PIN” status only — **no daily digest UI**.

### Industry pattern

Synthesis parent glance / 豆包提醒 — text, not charts. Matches zero-dashboard for child.

### Spark target wireframe

**SkillsPanel expanded, after PIN unlock**

```
┌─ Learning ─────────────────────┐
│ … Stronger / Focus …           │
│                                │
│ Parent                         │
│ ┌────────────────────────────┐ │
│ │ Today: Fractions · stuck   │ │
│ │ on ÷3 · offered 3 drills   │ │
│ │ (skipped)                  │ │
│ │ [Copy]  [Done]             │ │
│ │ ▸ Yesterday                │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

### States / copy / a11y

| State | UI |
|-------|-----|
| no PIN | “Set parent PIN” entry |
| locked | digest hidden |
| unlocked | one-liner + Copy / Done |
| Done / lock | hide digest |

- No radar, heatmap, or skill graph  
- Generation logic out of scope for this UI spec  

### Acceptance

- [ ] Child never sees digest without PIN  
- [ ] Single paragraph max ~280 chars  
- [ ] Lock clears digest from view  

---

## 9. D1 — Check mode (P2)

### Current code

No check-mode toggle or banner.

### Industry pattern

Parent override for “show work” must be loud while active and easy to exit — otherwise child learns to stall for answers.

### Spark target wireframe

**PIN-only toggle in SkillsPanel Parent section**

```
[ ] Check answers (parent)
```

**Main header banner when ON**

```
┌─────────────────────────────────────────────┐
│ Check mode — answers shown        [ Exit ]  │
└─────────────────────────────────────────────┘
```

### States / copy / a11y

| Event | UI + policy |
|-------|-------------|
| Enable | banner on; prompt strategy = full steps |
| Exit / PIN lock | banner off; **force Socratic** |
| Child path | toggle not rendered |

### Acceptance

- [ ] Toggle invisible without PIN  
- [ ] Banner always visible while active  
- [ ] Exit clears mode before next child turn  

---

## 10. P1 lightweight (no new pages)

| ID | Current | Target UI |
|----|---------|-----------|
| **C1** Scratch | photo in user bubble | Agent points to step in prose; no canvas v1 |
| **C2** Misconceptions | — | **No child UI** |
| **C3** Multi-rep | analogy in prompts | New diagram/example in assistant bubble only |
| **C4** Dynamic board | SVG in stream | Replace prior SVG with same `diagramId` (streaming-render-fix) |
| **A3** Cross-day gaps | — | Reuse B1 card; copy may cite “last few days” |
| **B3** Voice tolerance | — | Assistant bubble + chips `Did you mean A / B?` after Phase G |

### Acceptance (P1 UI)

- [ ] No new routes or mode switchers for C1–C4  
- [ ] B3 chips ≥44px when implemented  

---

## 11. UI anti-patterns

| Forbidden | Why |
|-----------|-----|
| Knowledge map / skill tree for child or parent | Course-platform smell |
| Streaks / leaderboards / XP bars | Extrinsic grind |
| Child multi-tab learning center | Breaks chat-first |
| Empty-state illustration collage | Noise (QANDA: no illustration) |
| Faux tappable chips | Affordance lie |
| Full-screen voice orb as default | Wrong for homework desk |
| Check mode without PIN / without banner | Spoiler leak |

---

## 12. Gap checklist (code vs this spec)

UI-POLISH (2026-08-09) closed the actionable gaps below. **UI-P1** stays with P1 feature work.

| ID | Gap | Status |
|----|-----|--------|
| **UI-E1** | Empty Photo/Voice pills → real Snap CTA | ✅ |
| **UI-A1a** | Progress chip expandable checklist | ✅ |
| **UI-A1b** | “All done · N” auto-dismiss 3s | ✅ |
| **UI-A2a** | Dismiss same-day suppress | ✅ |
| **UI-B1a** | Snap homework opens camera | ✅ |
| **UI-B2a** | Speaking mic ring + status line | ✅ |
| **UI-D2** | Parent daily one-liner (PIN) | ✅ |
| **UI-D1** | Check-mode toggle + banner | ✅ |
| **UI-P1** | diagramId replace / B3 chips | deferred (P1) |

### Suggested polish order

1. UI-B2a (speaking affordance)  
2. UI-E1 + UI-B1a (honest empty CTAs)  
3. UI-A1a/b (chip expand + done)  
4. UI-A2a (same-day suppress)  
5. UI-D2 then UI-D1 (parent PIN surfaces)

---

## 13. Phone vs desktop notes

| Surface | Phone | Desktop |
|---------|-------|---------|
| Empty + cards | Centered; max-w-md | Same, in main column |
| Progress chip | Sticky under header | Sticky top of chat column |
| Expanded checklist | Full width of chat column | max-w-md centered |
| Parent D2/D1 | Sidebar drawer | Persistent left sidebar |
| Check banner | Full width under header | Same |

---

*Spec only — implementing gaps is a separate TODO polish phase.*
