# Teochew STT Remediation — Generic Minnan vs. Local Chaoshan

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)
> Status: **proposed** · 2026-08-10
> Trigger: production feedback — "客家话还可以，但潮汕话非常偏闽南语，没有本地潮汕话，基本是闽南话了"
> Upstream: [dialect-support-teochew-hakka.md](dialect-support-teochew-hakka.md) · [dialect-speech-optimization-stt-tts.md](dialect-speech-optimization-stt-tts.md) · [dialect-cloud-tts-stt-correct.md](dialect-cloud-tts-stt-correct.md)
> Downstream: [TODO.md § Competitive Analysis Backlog / Phase G](../TODO.md)

---

## 1. Problem statement

Real-world use confirms a quality split between the two dialects on the current Bailian-primary STT pipeline:

| Dialect | Production quality |
|---|---|
| Hakka (客家话) | Acceptable |
| Teochew (潮汕话) | Recognized as **generic Minnan (闽南语)**, not authentic local Chaoshan (潮州/汕头/揭阳) speech |

This is not a one-off glitch — it reproduces on real usage, and it lines up exactly with a gap this repo's own research already flagged before Bailian was wired up as primary. This doc formalizes root cause, and a remediation path that doesn't require guessing twice.

---

## 2. Root cause (verified against code + current Aliyun docs, 2026-08-10)

### 2.1 There is no per-dialect language code — it's a design limit of the API, not a bug

`bailianAsrLanguageHint()` (`src/lib/bailian-asr.ts:30-50`) maps both `teo` and `hak` to `asr_options.language = "zh"`:

```ts
case "zh":
case "teo":
case "hak":
  return "zh";
```

This looked suspicious at first read, but checking Aliyun's current Fun-ASR-Flash documentation confirms it's correct as implemented: Fun-ASR-Flash advertises coverage of "普通话、粤语、吴语、闽南语、客家话、赣语、湘语、晋语…" all under the single `zh` language bucket — there is no separate enum value like `"nan"` or `"teochew"` to pass. The model is supposed to auto-detect the dialect internally. We cannot ask it for Teochew specifically; we can only ask for `"zh"` and hope the internal dialect classifier lands on the right branch.

### 2.2 Why the classifier lands on "generic Minnan" instead of Chaoshan

Teochew (潮汕话) is genealogically Southern Min (闽南语) — it's not a misclassification at the language-family level, it's a resolution problem: the model's internal "闽南语" bucket almost certainly reflects whatever Minnan-family training data was available at scale, which is overwhelmingly mainstream Xiamen/Taiwanese Hokkien (huge public corpora, huge speaker population) rather than the far smaller, more divergent Chaoshan sub-branch.

This matches a finding this repo's own research already produced independently: `dialect-speech-optimization-stt-tts.md` §2.1.3 notes the only public Teochew-specific ASR dataset (`panlr/teochew_wild`) is 18.9 hours, 12,500 clips, 20 speakers — vs. Taiwanese Hokkien corpora that run into the thousands of hours (`MediaTek-Research/Breeze-ASR-26`: 10,000 hrs). Any commercial "闽南语" bucket trained at Alibaba's scale is going to be dominated by the same imbalance. The production symptom (Chaoshan input → generic-Minnan-flavored output) is the expected consequence, not a fluke.

### 2.3 A second, independent bug: the iFlytek fallback can never actually help today

This is worth flagging on its own, separate from the model-quality issue above. `route.ts`'s call order is:

```
① tryBailianAsr()          — primary
② tryIflytekDialectBackup() — only runs if ① returns null
③ local Whisper             — only runs if ① and ② both return null
```

`tryBailianAsr` returns non-null whenever it gets any text back — including the wrong-flavored generic-Minnan text that's the whole problem here. It never fails; it just succeeds with low-quality output. This means step ② never executes for Teochew today, even if someone sets `STT_BACKUP_IFYTEK=1`. The fallback is wired for outage recovery, not quality routing — turning the flag on would do nothing for this specific complaint. Any fix has to change the routing logic itself, not just an env flag.

### 2.4 iFlytek isn't a guaranteed fix either — it's an untested hypothesis

The original Plan A research (`dialect-cloud-tts-stt-correct.md` §0) picked 讯飞方言识别大模型 as "most credible" specifically because it claims 202 dialects including explicitly named 潮汕话 — a much finer-grained catalog than Aliyun's 8 broad Chinese-dialect groups. That's a real reason to expect it's better for Teochew specifically. But two caveats, both visible in code:

- `iflytek-asr.ts:173` hardcodes `accent: "mulacc"` (multi-accent auto-detect) — same "let the model guess" pattern as Bailian, just with (claimed) finer-grained categories underneath.
- Nobody has actually run Teochew audio through it and compared. The 202-dialect claim is vendor marketing, not measured.

We should not swap one unverified default for another. Section 4 designs the A/B needed to know before committing.

---

## 3. Options considered

| Option | Cost | Verdict |
|---|---|---|
| **A.** Small real-audio A/B: Bailian vs. iFlytek on actual Teochew clips | ~1 hr human time, near-zero API cost | **Do this first** — turns "讯飞 202 方言" from a vendor claim into a measured fact before any routing change |
| **B.** Per-dialect engine routing (not blanket flag) — `teo` tries iFlytek first if A confirms it's better; `hak` stays as-is since it's already acceptable | Small code change, bounded ongoing cost (only `teo` traffic pays for iFlytek) | Do if A confirms iFlytek wins |
| **C.** Fine-tune `panlr/whisper-finetune-teochew` or similar on real Chaoshan data | Needs GPU — repo's own infra docs already ruled this infeasible on the current CPU box | Defer — real fix, wrong time |
| **D.** Keep relying on the existing edit-before-send correction flow (`dialect-stt-correct.ts`) as the safety net regardless of which engine wins | Already built, zero new cost | Keep unconditionally — this is the backstop no matter what A/B says |
| **E.** Do nothing, accept generic-Minnan quality | Free | Rejected — this is the status quo that prompted the complaint |

---

## 4. A/B eval design

### 4.1 Sample set

12-15 real Teochew speech clips. Source strategy (in priority order):

1. **Internet Teochew speech datasets** — `panlr/teochew_wild` on HuggingFace (18.9 hrs, 12,500 clips, 20 speakers) provides high-quality Chaoshan-native audio. Sample clips from this dataset for eval.
2. **YouTube/online Teochew recordings** — public-domain Teochew conversations, songs, or language-learning content downloadable as 16kHz mono WAV.
3. **Family recordings** — if internet samples lack specific domains (homework phrases, math terms).

Recording specs:
- 16kHz mono WAV format (same as `VoiceControls` → `transcribeBlob` production audio)
- Phrases a G4 kid would plausibly say: greetings, "我做完功课了" style homework phrases, a few number/math terms (ties directly into the B3 confusable-glossary work), a couple of longer natural sentences.

Store under `eval/teochew-stt/samples/` with a matching `manifest.json`:

```json
{
  "file": "ts-01.wav",
  "speaker": "teochew_wild_dataset",
  "gloss": "汝食了未",
  "domain": "greeting"
}
```

`gloss` is a human transcription in Chaoshan written form (per the orthography conventions already documented in `dialect-support-teochew-hakka.md` §2.1) — this is the ground truth, not a Mandarin translation.

### 4.2 Harness

`scripts/eval-teochew-stt.mjs` — mirrors the pattern from the CA-P0 acceptance harness (`ca-p0-acceptance-hardening.md` §1.3):

1. For each sample, call both engines directly (not through the production fallback chain, since §2.3 established that chain never lets iFlytek run today):
   - `transcribeWithBailian(bytes, { language: "zh" })`
   - `transcribeWithIflytek(config, bytes)`
2. Record both raw outputs per sample.
3. **Scoring is human, not automated** — CER against a 15-word gloss is noisy and this is exactly the kind of judgment (does this sound like Chaoshan vs sound like generic Hokkien) that needs a native speaker, not a string diff. Two columns per sample: "usable as-is" (yes/no) and "closer to Chaoshan" (Bailian / iFlytek / neither / same).
4. Output `eval/teochew-stt/results-{date}.md` — a simple table, plus a one-line recommendation.

### 4.3 Decision rule

- If iFlytek is "closer to Chaoshan" or "usable as-is" on a clear majority of samples → proceed to §5 routing change for `teo` only.
- If it's a wash or Bailian is comparable → don't add iFlytek cost/complexity; instead lean harder on §6 (correction-loop) as the practical mitigation, and log this as a closed investigation (not a permanent "todo").
- Either outcome is a valid, useful result — this eval is designed to end the guessing either way, not to justify a predetermined answer.

---

## 5. Routing change (only if §4 confirms iFlytek wins for Teochew)

### 5.1 Design

Replace the single implicit "Bailian, then iFlytek-on-failure" chain with an explicit, per-dialect ordered list, defaulting to today's behavior for everything except `teo`:

```ts
// src/lib/stt-engine-order.ts
export type SttEngine = "bailian" | "iflytek" | "local";

const DEFAULT_ORDER: Record<string, SttEngine[]> = {
  teo: ["iflytek", "bailian", "local"],   // flips only if §4 confirms
  hak: ["bailian", "local"],              // unchanged — already acceptable
  default: ["bailian", "local"],
};

export function sttEngineOrder(lang: string): SttEngine[] {
  const raw = process.env[`STT_ENGINE_ORDER_${lang.toUpperCase()}`];
  if (raw) return raw.split(",").map(s => s.trim()) as SttEngine[];
  return DEFAULT_ORDER[lang] ?? DEFAULT_ORDER.default;
}
```

`route.ts`'s `POST` handler walks `sttEngineOrder(language)` and tries each engine in order regardless of whether the previous one "succeeded" for dialect languages specifically (still short-circuits on first non-empty result for `en`/`zh`/`yue`/etc., where today's outage-recovery-only behavior is fine and cheaper). This is the actual fix for §2.3's bug — quality routing, not just outage fallback, but scoped to only the two dialects where it matters.

### 5.2 Cost containment

Only `teo` traffic gets an extra API call in the new default order (iFlytek runs first instead of never); `hak` is untouched, so the original "控费" (cost control) reasoning for keeping iFlytek default-off stays respected — we're not turning it on globally, just for the one dialect where the data supports it.

### 5.3 Tasks

- [ ] **TEO.1** — `stt-engine-order.ts` + unit tests (env override, default table, unknown lang falls back to `default`)
- [ ] **TEO.2** — Rewire `route.ts` `POST` to walk the ordered list for `teo`/`hak` instead of the current fixed ①②③ chain
- [ ] **TEO.3** — Regression test: `hak` behavior unchanged (still Bailian-first, iFlytek only on outage)

---

## 6. Feedback loop tie-in (do regardless of §4/§5 outcome)

`dialect-stt-correct.ts` already has the right shape — LLM correction pass using `topDialectWords()` from `teochew-dict.ts`'s community-verified entries, and the transcript is edit-before-send, never auto-sent. Two small additions make this pipeline actually accumulate a real Chaoshan corpus over time instead of just papering over each individual mistake:

1. **Tag which engine produced the raw transcript** in `dialect-feedback.ts`'s `DialectFeedback` type (`engine: "bailian" | "iflytek" | "local"`) — without this, feedback data can't later answer "did the routing change in §5 actually help," it can only show aggregate correction rate.
2. **Log the correction diff, not just final text** — currently `appendDialectFeedback` only stores the corrected text. Add `original` alongside it. The (original → corrected) pairs are the actual training-data-shaped asset if a future GPU-fine-tune (§3 Option C) ever becomes feasible — this is the cheapest possible way to start building toward the "real fix" without doing it now.

### 6.1 Tasks

- [x] **TEO.4** — Add `engine` + `original` fields to `DialectFeedback`, update `dialect-feedback.test.ts` (6 tests passing)
- [x] **TEO.5** — Wire Composer dialect-correct path to POST `/api/dialect-feedback` with `engine` + `original` (VoiceControls passes STT `engine`)

---

## 7. Non-goals

- No GPU fine-tuning of a dedicated Teochew model now (Option C stays deferred — this doc is about getting the most out of the two commercial APIs already integrated).
- No change to Hakka's routing — it's already acceptable, don't touch what isn't broken.
- No change to TTS. This doc is STT-only; the Cantonese-voice TTS fallback for Teochew (`dialect-support-teochew-hakka.md` §1) is a separate, already-known-and-accepted limitation. TTS quality improvements (family voice clone **15.2.6**) are tracked separately in TODO.md Phase 15.
- Not attempting to make the eval in §4 statistically rigorous (12-15 samples, human-scored) — the point is to end a guessing loop cheaply, not to publish a benchmark.

---

## 8. Files

| File | Change |
|---|---|
| `eval/teochew-stt/samples/*.wav` + `manifest.json` | New — real Teochew clips + ground truth |
| `scripts/eval-teochew-stt.mjs` | New — A/B harness (§4.2) |
| `eval/teochew-stt/results-{date}.md` | New — eval output |
| `src/lib/dialect-feedback.ts` | Modified — add `engine`, `original` fields (§6) |
| `src/lib/dialect-feedback.test.ts` | Modified — 6 tests covering new fields (§6.1) |
| `src/lib/stt-engine-order.ts` | New — per-dialect engine order (§5.1), only built if §4 recommends it |
| `src/lib/stt-engine-order.test.ts` | New |
| `src/app/api/transcribe/route.ts` | Modified — walk ordered list for `teo`/`hak` (§5.1) |

---

## 9. TODO.md wiring (paste into repo, under Phase G)

```md
- [ ] **TEO.0** — Real-audio A/B: Bailian vs. iFlytek on 12–15 Teochew clips (internet datasets + human-scored) — see [teochew-stt-remediation.md](subsystems/teochew-stt-remediation.md) §4
- [x] **TEO.4** — Feedback log: `DialectFeedback.engine` + `.original` fields — §6
- [x] **TEO.5** — Wire UI call site to pass `engine` + `original` through — §6
- [ ] **TEO.1–3** — Per-dialect STT engine routing (only if TEO.0 confirms iFlytek wins for teo) — §5
```

Add this doc to `DESIGN.md`'s document map next to `dialect-cloud-tts-stt-correct.md`.

---

## 10. Changelog

- **2026-08-10** — doc drafted from production feedback; TEO.4 completed (feedback fields enriched); TEO.0 eval not yet run (blocks TEO.1–3, does not block TEO.5).
