# Physics Learning Games — Research & System Design

> Version 0.1 · 2026-08-14 · **Implemented in source + Vitest; NOT deployed to production**
> Scope: add science/physics Learning Games on `/entertain`, starting from Ryan’s stated physics interest.
> Sibling: [learning-games.md](./learning-games.md) (current three games + shared principles)
>
> **Production lock:** customers are on live `spark-tutor` (PM2 serves built `.next`). Do not `npm run build` / `pm2 restart` / push until explicitly approved.

---

## 0. Decision in one screen

| Question | Answer |
|----------|--------|
| Replace Eco Genesis? | **No.** Eco Genesis covers *life science* (ecosystems). Physics is a different science domain. |
| How many new games now? | **Design three, build one.** Flagship first: **Force Bay**. |
| Start at G6 algebra physics? | **No.** Ryan is 9, BASIS G4. Qualitative forces / energy / collisions first; `physics-6-8` is the *stretch* target, not the on-ramp. |
| Embed PhET / Box2D / Matter.js? | **No.** Constrained, discrete, testable engine (same pattern as Eco Genesis). PhET is the *pedagogy* reference, not a dependency. |
| Quiz / matching worksheets? | **No.** Violates “mechanic IS the lesson.” |
| Ready to code? | **Not yet.** Confirm Force Bay as P0, then implement. |

**Recommended P0:** **Force Bay** (力湾) — apply force arrows, predict, watch a discrete motion stepper. Wrong push misses the dock and bounces back.

---

## 1. Why this, why now

### 1.1 Learner evidence (Ryan)

| Signal | Evidence |
|--------|----------|
| Stated interest | Vocabulary session: *“i'm intruing in phisics”* → tutor treated as “loving physics.” |
| Profile | Age **9**, Grade **4**, BASIS International; `stronger: ["science curiosity", …]`. |
| Curriculum today | BASIS G4 science = solar system / Earth–Moon–Sun, ecosystems, simple experiments — **no dedicated physics unit**. |
| Mastered adjacent | `earth-moon-sun` pKnown **0.999** (25 attempts); `science-observations` **0.999**. |
| System already wants physics | `gapHistory` lists `physics-6-8` for 2026-08-10…13 — catalog marks it adjacent to Earth–Moon–Sun, but Ryan has **no elementary physics skill row**. |
| Scientific method | `scientific-method` pKnown **0.001** — predict-then-run games can feed this without lecturing. |
| Explore catalog | “Space & planets” and “Cars, planes & machines” already seed `physics-6-8`. |

Ryan is not a middle-school physics student who needs \(F=ma\) worksheets. He is a G4 kid who *named* physics as intriguing, already lights up space, and has a catalog hole between “Moon phases” and “G6–8 physics.”

### 1.2 Product hole

Current Learning Games (2026-08-13 rewrite):

| Game | Domain | Catalog skills |
|------|--------|----------------|
| Fraction Voyager | Math | fractions-concepts, equivalent-fractions |
| Eco Genesis | Life science | ecosystems (+ earth-moon-sun seed) |
| Time Vault | History / reading | ancient-civ, reading-evidence |

Science on the Games hub = **food webs only**. Physical science (force, motion, energy, collisions) has no mechanic. That is the gap this design fills.

---

## 2. Research synthesis

### 2.1 Standards (what G4 physics actually is)

NGSS physical science around Ryan’s grade is **not** Newton’s laws as equations. It is:

| Code | Idea (kid language) | Game implication |
|------|---------------------|------------------|
| **3-PS2-1** | Balanced vs unbalanced forces — still / start moving | Two opposing arrows; net zero = stay |
| **3-PS2-2** | Motion has a pattern you can predict | Predict landing zone *before* run |
| **3-PS2-3** | Magnets / electric forces (optional later) | Defer to P2+ |
| **4-PS3-1** | Faster ↔ more energy of motion | Speed bar, not a formula |
| **4-PS3-2** | Energy moves as sound, light, heat, current, motion | Energy Chain (P1) |
| **4-PS3-3** | Collisions change energy / motion — predict | Collide missions |
| **4-PS3-4** | Design a device that converts energy | Energy Chain engineering loop |
| **4-PS4-1** | Waves: amplitude / wavelength | Defer (more abstract, weaker “physics intrigue”) |
| **5-PS2-1** | Gravity pulls down | Orbit Scout qualitative only |

Classroom units that work (Cereal City, KnowAtom) use **ramps, marbles, collisions, levers, Rube Goldberg energy devices** — not quizzes matching “wavelength” to a definition.

BASIS G4 science stays on space + ecosystems; G6–8 physics (motion → forces → energy) is the *next band*. Spark should offer a **G4 on-ramp** that stretches toward `physics-6-8` via BKT, not dump G7 content on a 9-year-old.

### 2.2 What the industry got right (and wrong)

| Reference | Take | Use / reject |
|-----------|------|----------------|
| **PhET Energy Skate Park / Forces & Motion** | Implicit scaffolding: affordances + constraints + live feedback; student agency; visualize the invisible (energy bars, force arrows). Research: Podolefsky, Adams, et al., *Implicit scaffolding in interactive simulations* (arXiv:1306.6544). | **Use the pedagogy.** Do not iframe PhET (no BKT, no misconception tags, third-party). |
| **Algodoo / Crayon Physics** | Open sandbox; kids *play* physics. Euler et al.: less-constrained tools need teacher framing or they wander. | **Reject as the core loop.** Too unconstrained for ZPD + BKT. Sandbox tab later, if ever. |
| **Angry Birds / World of Goo** | Trajectory and construction feel great; physics stays *implicit*. Students do not extract force/energy without a predict + name-the-cause step. | Steal the **feel** (launch, miss, retry). Add **prediction** and **force arrows**. |
| **The Incredible Machine / Contraption Maker** | Energy conversion as a build-and-run chain. Maps cleanly to 4-PS3-4. | Pattern for **Energy Chain** (P1), same as Eco Genesis build → predict → simulate. |
| **Kerbal Space Program** | Highest “I love physics” fantasy (rockets). Orbital mechanics is famously anti-intuitive even for adults. | Theme only (docks, crafts). **No Kepler.** Orbit Scout stays qualitative gravity. |
| **Workybooks-style matching games** | Cheap NGSS alignment; mechanic is “pick the label.” | **Reject.** Same failure mode as old Fraction Forge (forms, not play). |

### 2.3 Misconceptions the game must make *visible*

Force Concept Inventory + elementary research (heavier-falls-faster, force-needed-to-keep-moving, energy-used-up) are the teaching targets. Catalog today only has `science-earth-scale` and `science-eco-foodchain` — **zero physics tags**.

| Id | Pattern | Visible consequence in Force Bay |
|----|---------|----------------------------------|
| `phys-force-to-keep-moving` | “Needs a push the whole way or it stops” | Coasting craft keeps moving when arrows are removed (friction off) |
| `phys-heavier-faster` | “Heavier always faster / always hits harder” | Same push, bigger mass → *less* speed |
| `phys-heavier-falls-faster` | “Heavy things fall faster” | Two crafts, same drop, same time (later mission) |
| `phys-more-force-always` | Ignores mass; bigger arrow always wins regardless of mass | Side-by-side mass contrast |
| `phys-balanced-still-force` | “If it isn’t moving, no forces” | Stationary cart with two equal opposite arrows |
| `phys-energy-used-up` | Energy disappears rather than converting | Energy Chain: bar moves from height → motion → heat |
| `phys-gravity-gets-stronger` | Gravity increases as you fall | Constant downward arrow (Orbit Scout) |

Wrong answers must **move the world**, not show a red X (existing Learning Games rule).

### 2.4 Shared Learning Games principles (do not weaken)

From [learning-games.md](./learning-games.md):

1. The game mechanic **is** the learning — no text inputs, no dropdowns.
2. Wrong answers have **visible world consequences** + Answer-Until-Correct.
3. **ZPD + BKT** via `recordStudioLearningTurn` + `applyMisconceptionToMemory`.
4. Private collection only — no public leaderboards.
5. Pure functions in `src/lib/entertain/*`, UI in `src/components/*Game.tsx`, Vitest in node env.

**Physics-specific extra (from PhET + Eco Genesis):** every scored round is **Predict → Run → Compare**. Watching a sim without a prediction is entertainment, not ICAP active engagement. Eco Genesis already does this; Force Bay must too.

---

## 3. Catalog & data-loop changes (before any game UI)

Physics games will not attribute cleanly unless the skill graph grows. Today `physics-6-8` is `minGrade: 6` — G4 play will either miss the skill or inflate a middle-band id.

### 3.1 New elementary skills

```
science-observations  →  earth-moon-sun  →  forces-motion  →  physics-6-8  →  honors-physics
                              ↓                    ↓
                         ecosystems          energy-transfer
                         (Eco Genesis)       (Energy Chain P1)
```

| id | Label | Band | min–core–max | Adjacent |
|----|-------|------|----------------|----------|
| `forces-motion` | forces & motion | elementary | 3–4–6 | `physics-6-8`, `geometry-measure`, `earth-moon-sun` |
| `energy-transfer` | energy transfer | elementary | 4–4–6 | `forces-motion`, `physics-6-8`, `scientific-method` |

`physics-6-8` stays the stretch skill (difficulty 4–5 missions; algebra still not required). `honors-physics` stays untouched.

Regex seeds (for `inferSkillsFromText`): force, motion, push, collide, gravity, 力, 运动, 碰撞; energy, kinetic, potential, 能量, 动能.

### 3.2 Misconception seed additions

Add the `phys-*` ids in §2.3 to `MISCONCEPTION_SEED` with `skillIds` pointing at `forces-motion` / `energy-transfer`. Tutor chat then inherits the same fences Fraction Voyager already writes.

### 3.3 Attribution source (existing bug, fix while adding)

`StudioLearningSource` is `"ted" | "writing" | "natgeo" | "bbc" | "rsa"`. Current games **misuse** it:

- Fraction Voyager / Time Vault → `source: "writing"`
- Eco Genesis → `source: "natgeo"`

Parent digest then counts physics play as writing or NatGeo. **Add `"game"`** (or per-game ids) and seed text that names the real skill. Do this in the same PR as Force Bay, and migrate the three existing games.

### 3.4 Explore / Me hub

- Add explore topic **“Forces & motion”** (or fold into vehicles + space with stronger `forces-motion` skillIds).
- After a Force Bay session, `recordInterest({ topicId: "physics" })` so curiosity map can show physics, not only chat picks.

---

## 4. Game portfolio

Design three games that share one engine family. **Ship only Force Bay first.**

### 4.1 P0 — Force Bay (力湾)  ← build this

**Fantasy:** A harbor / space dock. Crafts wait on a rail. Ryan applies **force arrows**, predicts which dock they hit, then the world runs.

**Why first:** Closest to “I like physics,” NGSS 3-PS2 + 4-PS3-1/3, visual arrows (PhET), 1D stepper is testable, reuses Fraction Voyager’s number-line spatial feel.

#### Loop

1. **Brief** — one sentence: “This barge needs the green dock. Give it a push.”
2. **Apply** — tap direction (left/right) and strength (1–5 chevrons). Optional second arrow (balance missions). Optional mass chip (light/heavy). No typing.
3. **Predict** — tap a dock / zone on the rail *before* run. Cannot skip.
4. **Run** — discrete stepper animates. Ghost marker shows the prediction.
5. **Compare**
   - Prediction + landing both right → dock lights up, collection shard, BKT `correct`.
   - Landing wrong → craft overshoots and **bounces back** (AUC); misconception id if pattern matches; BKT `incorrect`.
   - Landing right, prediction wrong → dock lights but “you got lucky — say where *before* next time”; outcome `practice` (honest signal).

#### Mission kinds

| Kind | Trains | Interaction |
|------|--------|-------------|
| `push` | Unbalanced force → motion | One arrow, land in a zone |
| `balance` | Net force | Two opposite arrows; equal = stay, unequal = creep |
| `collide` | 4-PS3-3 | Moving craft hits a parked one; predict who moves / both / bounce |
| `mass` | a = F/m without the formula | Same arrow, two masses; pick which goes farther |
| `ramp` | Speed ↔ height (energy on-ramp) | Unlock when `forces-motion` pKnown ≥ 0.70 |

#### Discrete engine (pure, no Box2D)

Integer-friendly 1D (extend to 2D later only if tests stay honest):

```typescript
type Body = {
  id: string;
  x: number;       // dock index units
  v: number;       // cells per step
  mass: 1 | 2 | 3;
  friction: number; // 0 or small
};

function netForce(arrows: ForceArrow[]): number;
function stepBody(body: Body, force: number): Body; // v += force/mass; x += v; apply friction
function runBay(bodies, arrows, steps): BayRun;     // snapshots + landedZone + collisions
```

Constraints (implicit scaffolding):

- Arrows snap to the craft, not free-floating vectors.
- Strength is 1–5 chevrons, not newtons.
- Docks are large zones (forgiveness at low difficulty).
- Friction is a **visible** drag parachute when on — never a hidden stop.

#### ZPD ladder (`difficultyFromPKnown`)

| pKnown | Diff | Mission mix | Extra |
|--------|------|-------------|-------|
| < 0.30 | 1 | `push` only | friction off, 3 large docks |
| < 0.50 | 2 | `push` + `balance` | 4 docks |
| < 0.70 | 3 | + `collide` | two bodies, equal mass |
| < 0.85 | 4 | + `mass` | mass 1 vs 3; seed `physics-6-8` |
| ≥ 0.85 | 5 | + `ramp` | height, stretch language (“more motion energy”) |

New skill defaults to ~0.40 prior → Ryan starts at diff 2, not a G7 problem set.

#### Collection

Light up **docks** on a private harbor map (same spirit as Voyager stars / Genesis biomes / Vault artifacts). No scores on a public board.

#### Files (when implementing)

| File | Role |
|------|------|
| `src/lib/entertain/force-bay.ts` | Missions, stepper, validation, ZPD, skill seed |
| `src/lib/entertain/force-bay.test.ts` | Diff bands, each kind correct + each `phys-*` path, conservation-ish collide |
| `src/components/ForceBayGame.tsx` | Dock UI, arrows, prediction taps, bounce |
| `src/lib/entertain/types.ts` | `GameId` += `"force-bay"` |
| `src/components/EntertainPage.tsx` | Register as 4th Learning Game, still first section |

---

### 4.2 P1 — Energy Chain (能量链)

**Fantasy:** Snap conversion tiles into a machine that must ring a bell / light a lamp.

**Loop:** identical to Eco Genesis — **build → predict → simulate**. Tiles: height, spring, motion, heat, sound, light, battery. Illegal or leaky chains fade (energy “used up” misconception). Disaster analog: add friction / a break in the chain.

**Skills:** `energy-transfer`, `scientific-method`. Unlock when `forces-motion` pKnown ≥ 0.55 so Force Bay remains the door.

**Do not build in the first slice.** Reuse `stepEcosystem`-style discrete conservation: sum of energy bars constant unless a leak tile is present.

---

### 4.3 P2 — Orbit Scout (巡轨)

**Fantasy:** Tiny craft around a planet. Connects mastered `earth-moon-sun`.

**Hard constraint:** qualitative only — gravity always points down / toward the planet; higher push → higher arc; no orbital velocity puzzles, no Hohmann transfers.

**Skills:** `earth-moon-sun`, `forces-motion`, stretch `physics-6-8`. Misconception `science-earth-scale` + `phys-gravity-gets-stronger`.

**Defer** until Force Bay is in weekly use. Kerbal fantasy is tempting; Kepler will punish a 9-year-old.

---

### 4.4 Explicitly out of scope (near term)

- Wave lab (4-PS4) as a first physics game
- Chemistry / atoms (Ryan asked for physics; Eco Genesis already holds life science)
- Full Algodoo sandbox
- PhET iframe
- Numeric kinematics worksheets (`v = d/t` drill)
- Multiplayer / leaderboards
- Replacing or renaming the existing three Learning Games

---

## 5. System architecture

```
EntertainPage (Learning Games, first section)
    ├── Fraction Voyager     math / fractions
    ├── Eco Genesis          life science / ecosystems
    ├── Time Vault           history / evidence
    └── Force Bay            physical science / forces-motion   ← new
            │
            ▼
    force-bay.ts (pure)
            │  outcome + misconceptionId
            ▼
    recordStudioLearningTurn({ source: "game", … })
            │
            ▼
    learning-memory (BKT pKnown on forces-motion)
            ├── dashboard Progress
            ├── parent digest (real source, not "writing")
            ├── tutor misconception fences
            └── next Force Bay difficultyFromPKnown
```

Grid: keep Learning Games as the top section. Four cards wrap `1 / 2 / 3` columns as today (`md:grid-cols-3` → 3+1). Optional later: 2×2 on tablet. Do **not** bury Force Bay under Logic & Fun.

### 5.1 Shared physics kernel (only if P1 follows)

If Energy Chain ships, extract `src/lib/entertain/physics-step.ts` (bodies, forces, energy bars). **Do not extract speculatively** for P0 — YAGNI. Force Bay owns its 1D stepper until a second consumer exists.

### 5.2 Mobile / a11y

- Tap targets ≥ 44px (arrows, docks, predict chips).
- No drag-only mechanics; drag may *enhance* arrows, tap must suffice (Time Vault already does tap-to-place on phones).
- Color is not the only dock signal (shape + label).
- Respect existing Games homework nudge banner; never lock the game.

### 5.3 Test plan (P0)

```
npm test -- src/lib/entertain/force-bay.test.ts
```

Must cover: `difficultyFromPKnown` band edges; `push` / `balance` / `collide` / `mass` correct paths; each `phys-*` detection; friction-off coasting; prediction vs landing outcome matrix (`correct` / `incorrect` / `practice`); seed text matches `forces-motion` regex.

Self-verify: full `npm test` + `npx tsc --noEmit` before deploy (same gate as current Learning Games).

---

## 6. Implementation phases (after design sign-off)

| Phase | Work | Exit |
|-------|------|------|
| **P0a Catalog** | `forces-motion` + `energy-transfer` skills; `phys-*` tags; `StudioLearningSource` += `"game"`; migrate three existing games off writing/natgeo | Tests on catalog + studio-learning |
| **P0b Force Bay** | Logic + UI + EntertainPage card + BKT loop | 15+ unit tests; playable on phone; Progress shows forces-motion |
| **P0c Copy / interest** | Explore topic + post-play `recordInterest` | Curiosity map can show physics |
| **P1 Energy Chain** | Only if Force Bay is actually used (parent digest / play counts) | Same predict–simulate bar as Eco Genesis |
| **P2 Orbit Scout** | Only if `forces-motion` pKnown ≥ 0.70 for Ryan | Qualitative gravity; no orbital math |

Estimated size once approved: P0a ~0.5 day, P0b ~2–3 days (logic + motion UI is the risk), P0c ~0.5 day. **Do not start until this doc is confirmed.**

---

## 7. Acceptance criteria (Force Bay)

- [ ] No text inputs or dropdowns
- [ ] Predict is mandatory before run
- [ ] Wrong landing bounces the craft (AUC); no blocking “Try again” modal
- [ ] At least four `phys-*` misconceptions detectable from play, written into memory
- [ ] BKT updates `forces-motion` (not `narrative-writing`, not `ecosystems`)
- [ ] Difficulty follows pKnown table in §4.1
- [ ] Private dock collection only
- [ ] Works at 375px width
- [ ] Unit tests as §5.3
- [ ] Learning Games section still first; Force Bay is one of the prominent cards

---

## 8. Related docs

- [learning-games.md](./learning-games.md) — current three games, mechanic-is-lesson rules
- [entertainments.md](./entertainments.md) — `/entertain` hub
- [memory-bkt.md](./memory-bkt.md) — BKT engine
- [grade-agnostic-adaptive.md](./grade-agnostic-adaptive.md) — G4 baseline, G6–8 physics as next band
- [spark-research-roadmap.md](./spark-research-roadmap.md) — interest loop + ZPD
- Studio bridge: `src/lib/entertain/studio-learning.ts`
- Skill catalog: `src/lib/skill-catalog.ts`
- Misconceptions: `src/lib/misconceptions.ts`
