# CA-P0 Acceptance Hardening — A1.h / A2.h / CA-P0.R3

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)
> Status: **partially shipped** · 2026-08-10 · A2.h hooks + A1.h harness/mid-exit done; full 24-photo eval + R3 phone smoke remain  

> Upstream: [ca-p0-system-design.md](ca-p0-system-design.md) · [competitive-product-plan-v2.md](competitive-product-plan-v2.md)
> Downstream: [TODO.md § Competitive Analysis Backlog](../TODO.md)

---

## 0. Why this doc exists

CA-1…CA-4 (worksheet planner, practice loop, session opener, TTS barge-in) are **merged, unit-tested, and deployed** (`develop`, commit `175564d`). But three acceptance items are still open checkboxes, and they are not cosmetic — each one guards a real failure mode a child could hit on the live site:

| Open item | Risk if left unverified |
|---|---|
| **A1.h** — worksheet cut-accuracy eval | Agent silently mis-splits a page (wrong `total`, merged/duplicated items) and nobody notices until a parent complains |
| **A2.h** — session-end hook definition + drill quality | Practice offer only fires on explicit "New chat" — a child who just switches to another existing chat, or closes the tab, never gets the offer; nobody has defined what "quality" a generated drill must meet |
| **CA-P0.R3** — manual smoke M1–M4 | Code path never watched end-to-end by a human on the live phone UI |

This doc turns each into a concrete, runnable acceptance procedure so the checkboxes in `TODO.md` mean something.

---

## 1. A1.h — Worksheet cut-accuracy eval

### 1.1 What "cutting" actually is (read from code first)

There is **no separate OCR/vision microservice**. `worksheet-planner.ts` only *parses* a `~~~worksheet-plan` fence the multimodal agent emits per `prompts.ts` §"Worksheet planner — CA-1" contract (`src/lib/prompts.ts:426-436`). The "cut" happens **inside the model's vision reasoning**, not in deterministic code. That means:

- Unit tests (WP1–WP8) only prove the *parser* is correct given a well-formed fence — they say nothing about whether the model correctly counted/labeled items on a real photo.
- The only way to measure cut accuracy is an **end-to-end eval against real photos**, run through the same `/api/chat` path the child uses.

### 1.2 Eval set

Build `eval/worksheet-cut/` with **24 labeled samples**, stratified to match Ryan's actual homework mix (not a generic benchmark):

| Bucket | Count | Source |
|---|---|---|
| Pure computation (加减乘除竖式) | 6 | Anonymized real pages (redact name/school) or BASIS-style generated worksheets |
| Word problems (应用题, numbered 1–2 sentences each) | 6 | Real pages preferred — highest ambiguity risk |
| Fill-in-the-blank (填空) | 4 | Real or generated |
| Multiple choice (①②③④ / A/B/C/D) | 4 | Real or generated |
| Mixed-type single page (e.g. §1 computation + §2 word problems) | 2 | Real page — worst case for boundary detection |
| Single-item page (negative control — planner must **not** fire) | 2 | Any subject |

Each sample gets a hand-labeled ground truth JSON:

```json
{
  "file": "eval/worksheet-cut/samples/wp-07.jpg",
  "expected_total": 8,
  "expected_labels": ["Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8"],
  "planner_should_fire": true
}
```

### 1.3 Harness

`scripts/eval-worksheet-cut.mjs`:

1. For each sample, POST the image + a fixed opening prompt ("这是我的作业") to `/api/chat` exactly as the client would (reuse the attachment-encoding path from `attachments.ts`, not a hand-rolled payload).
2. Capture the first assistant turn, run `parseWorksheetPlanFence` on it.
3. Score against ground truth:
   - **Total-count match** — parsed `total === expected_total`
   - **Label-set match** — parsed item labels, order-insensitive, equal `expected_labels`
   - **Fire/no-fire correctness** — single-item pages must NOT emit a fence (planner over-triggering is its own failure mode, not just under-triggering)
4. Print a scorecard + write `eval/worksheet-cut/results-{date}.json` for regression tracking over prompt changes.

### 1.4 Pass bar (what "≥90%" means precisely)

- **Total-count exact match ≥ 90%** across the 22 multi-item samples (the original target from TODO).
- **Zero false-fires** on the 2 single-item negative controls — this bar is not "90%", it is 100%, because a false-fire forces a one-question worksheet into an unnecessary multi-turn flow.
- Label-set match is tracked but **not gating** at this stage — near-miss labels (e.g. `"1a"` vs `"Q1a"`) are a display nit, not a correctness failure, as long as `current`/`total` stay right.

### 1.5 Cross-question bleed check (manual, on the same 24 transcripts)

Automate what's checkable, hand-review what isn't:

- **Automated:** exactly one `status:"active"` item at any point in a transcript (already partially covered by `planFromJson`'s invariant, but that only proves the *parser* enforces it — re-check the *agent's emitted* fences too, since the model could emit two actives and the parser's fallback would mask a prompt problem).
- **Manual (2 reviewers, 24 transcripts, ~30 min):** for each item transition, does the tutor's dialogue reference the correct sub-question's numbers/context, or does it leak details from an adjacent item? Flag any bleed.

### 1.6 Mid-exit keeps done state

Code trace confirms this is **structurally already correct**: `worksheetPlan` lives on `ConversationRecord` (`TutorShell.tsx:1261` renders `active?.worksheetPlan`), so switching away and back restores the persisted plan — there's no separate "session" concept to lose it. What's missing is a **regression test locking this in**, since it's currently true by accident of architecture, not by an explicit contract:

- [ ] **A1.h.6** — Component test: render `ChatThread` with a conversation that has a 5/8-done `worksheetPlan`, unmount/remount (simulating tab switch), assert chip still reads `Question 6 of 8` (not reset to 1).

### 1.7 Tasks

- [ ] **A1.h.1** — Curate + label 24-sample eval set (real pages redacted where possible)
- [ ] **A1.h.2** — `scripts/eval-worksheet-cut.mjs` harness
- [ ] **A1.h.3** — Run baseline, record scorecard in this doc's changelog
- [ ] **A1.h.4** — If total-count match < 90%: tighten `prompts.ts` worksheet contract (e.g. explicit "count numbered items before emitting total" instruction), re-run
- [ ] **A1.h.5** — Manual bleed review on 24 transcripts
- [ ] **A1.h.6** — Mid-exit regression test (above)

---

## 2. A2.h — Session-end hook definition + drill quality

### 2.1 The actual gap (read from code first)

`createPracticeOffer` fires from exactly **one** call site: `startNewSession` in `TutorShell.tsx:799`, gated on `prevActive.messages.length >= 4`. Checked the other exit paths — none of them trigger it:

| Exit path | Triggers practice offer today? |
|---|---|
| Tap "New chat" after a ≥4-message session | ✅ Yes |
| `selectConversation(id)` — switch to a **different existing** chat | ❌ No (`TutorShell.tsx:836`, no digest/offer call) |
| Close tab / background the PWA | ❌ No — no `visibilitychange`/`beforeunload` handler at all |
| Leave the chat open and just... stop talking (idle) | ❌ No — no idle timer |

So today's "session end" is really "explicit New-chat click." For a K-10-year-old on a phone, switching to another chat or just closing the app is at least as common as tapping New Chat — meaning **most real sessions currently never generate a practice offer**, silently undercutting A2's whole value.

### 2.2 Definition (proposed)

A **session** is "closed" — eligible for digest + practice-offer generation — on the **first** of:

1. `startNewSession()` (existing, keep as-is)
2. `selectConversation(id)` where `id !== activeId` **and** the conversation being left has `messages.length >= 4` and hasn't already been closed (see idempotency below)
3. `visibilitychange` → `document.hidden === true`, debounced 30s (avoid firing on a quick app-switch-and-back, e.g. checking a photo in the gallery mid-homework)

`beforeunload` is **not** reliable enough to do async work (digest generation + `pushLearningMemoryToServer`) — skip it; rely on (3) covering the tab-close case on next load instead (see 2.4).

### 2.3 Idempotency guard

Because (2) and (3) can both fire for the same abandoned conversation (switch chat, then later the tab also loses visibility), track closure per-conversation:

```ts
// ConversationRecord gets an optional field
practiceOfferEmittedAt?: number; // set once createPracticeOffer succeeds for this conversation
```

`maybeCloseSession(conversation, mem, accountId)` becomes the single shared function all three triggers call; it early-returns if `practiceOfferEmittedAt` is already set. This also fixes a latent bug risk: today, repeatedly tapping New Chat back-and-forth across the *same* long conversation could in theory regenerate offers each time — the guard closes that too.

### 2.4 Missed-close recovery (covers hard tab-close)

On app load, before rendering, scan `store.conversations` for any conversation with `messages.length >= 4`, no `practiceOfferEmittedAt`, and `updatedAt` older than 10 minutes (i.e., clearly abandoned, not the one currently being typed in) → run `maybeCloseSession` for it. This catches the "closed the browser tab mid-homework" case without needing `beforeunload`.

### 2.5 Drill quality checks (the other half of A2.h)

`pickPracticeTargets` already sources from `skillWeaknesses` → `needsReviewSkills` → `zpdWarmUpSkills` (`session-practice.ts:64-73`) — the *selection* logic is fine. What's undefined is what happens **after** the offer is accepted: `buildPracticeKickoffMessage` hands the agent a free-text instruction ("Give me 3 short questions... Socratic hints only, no spoilers") with no structural check that the agent actually produces 3 ZPD-appropriate questions rather than, say, one question and then drifting into unrelated chat.

Proposed lightweight checks (no new infra — reuse the eval-harness pattern from §1.3):

- [ ] **A2.h.5** — 10-sample eval: for each of the 3 seeded weak-skill scenarios in `learning-memory.test.ts`, send the kickoff message, capture the agent's first 2 turns, hand-grade: (a) question difficulty plausibly ZPD for the stated skill, (b) no answer given away in the same turn, (c) question count doesn't silently balloon past 3.
- [ ] **A2.h.6** — If any scenario fails (b) — a spoiler — that's a **hard fail**, not a threshold; tighten the kickoff message template or the `homeworkCoach` anti-spoiler block it inherits from (`prompts.ts:395-407`).

### 2.6 Tasks

- [ ] **A2.h.1** — `maybeCloseSession()` shared helper + `practiceOfferEmittedAt` field on `ConversationRecord`
- [ ] **A2.h.2** — Wire trigger (2) into `selectConversation`
- [ ] **A2.h.3** — Wire trigger (3) `visibilitychange` (debounced) in `TutorShell`
- [ ] **A2.h.4** — Missed-close recovery scan on load (§2.4)
- [ ] **A2.h.5 / A2.h.6** — Drill-quality eval (§2.5)
- [ ] **A2.h.7** — Unit tests: SP8 (switch-conversation triggers offer), SP9 (idempotent — second trigger on same conversation is a no-op), SP10 (missed-close recovery picks up stale conversation)

---

## 3. CA-P0.R3 — Manual smoke on live

Still genuinely needs a human on the actual phone UI — this cannot be scripted away, but it can be made repeatable instead of ad hoc:

| # | Steps | Pass condition |
|---|---|---|
| **M1** | Photo a real ≥2-item worksheet page → send | Progress chip appears within one assistant turn; label matches item 1 |
| **M2** | Answer/skip through to item 3 of N, then tap **New chat** | Practice-offer empty-state appears with plausible skill labels |
| **M2b** *(new — covers §2)* | Same as M2, but instead of New chat, tap an **existing older chat** in the sidebar | Practice-offer still appears (was silently broken before A2.h) |
| **M3** | Fresh day, open app with no active chat | Opener chip appears once; typing "作业" in the composer suppresses it for the rest of the day |
| **M4** | During TTS playback, tap mic mid-sentence | Speech stops immediately, mic starts listening, no double-audio |
| **M5** *(new)* | Photo a **single-item** page | No worksheet progress chip appears at all (negative control from §1.4) |

- [ ] **CA-P0.R3** — Run M1–M5 on `https://spark-tutor-for-ryan.duckdns.org/` on an actual phone (not just desktop devtools mobile emulation — mic/camera permission flows differ), record pass/fail + screenshots in this doc's changelog.

---

## 4. TODO.md wiring (paste into repo)

Replace the three open lines under **P0 — shipped on `develop` · acceptance / hardening remaining** with:

```md
- [ ] **CA-P0.R3** — Manual smoke M1–M5 on live (see [ca-p0-acceptance-hardening.md](subsystems/ca-p0-acceptance-hardening.md) §3)
- [ ] **A1.h** — Worksheet cut-accuracy eval (24-sample set, ≥90% total-count match, 0 false-fires) — see §1
- [ ] **A2.h** — Session-end hook (switch-chat + visibility triggers, idempotent) + drill-quality eval — see §2
```

And add the doc to `DESIGN.md`'s document map next to `ca-p0-system-design.md`.

---

## 5. Changelog

- **2026-08-10** — doc drafted.
- **2026-08-10** — A2.h.1–4/7 shipped (`session-close.ts`); A1.h.2/3/4/6 shipped (offline fixture harness + mid-exit test + prompt tighten). Pending: A1.h.1 full 24 photos, A1.h.5 bleed review, A2.h.5–6 drill eval, CA-P0.R3 phone smoke.
