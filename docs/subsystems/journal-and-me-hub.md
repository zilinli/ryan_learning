# Journal + Me hub + Stage styles — product design

> 2026-08-12 · **Design only** — no implementation until product confirms the defaults below.  
> Status: **awaiting confirmation** · revised: Structure→default Stage style; journal = New + history; Creations auto-journal

This spec covers three linked decisions:

1. Per-account **Journal** (日记本) — UI + data + how it binds to Writing Studio **and My Creations**.
2. Whether Spark needs a **personal main page (Me)** that gathers Journal, My Creations, My Chat, Dashboard.
3. Moving **Stage style options** (Hip-hop / Indie / …) into the Stage panel — **Structure auto-picks a default, student can change**.

---

## 0. Confirm before build (defaults in **bold**)

| # | Decision | Recommended default | Alternatives |
|---|----------|---------------------|--------------|
| C1 | Personal home | **Yes — new `/me` “Me” hub**; keep `/` as chat; keep `/account` as profile settings | Expand `/account` into a mega page (rejected — form-heavy); skip Me and only add Journal inside Studio |
| C2 | Journal compose | **Write inside Writing Studio** (`writingType: journal`); **Journal home = New + full history list** (Day One / Journey pattern) | Separate rich-text editor (duplicates pad/coach/mic) |
| C3 | Privacy | **Student-private by default**; Family PIN can *read* (not edit); no public feed | Student-only even from Family; optional public share like Creations |
| C4 | Daily prompt | **One Spark prompt on Me + empty pad** (Apple Journal “suggestion”, not a quiz) | No prompts; 5-minute gratitude template |
| C5 | Stage styles | **Live in Stage**; **Structure sets a suggested default from the lyrics/prompt**; student may change before Generate | Leave genre on pad; Structure does not touch style |
| C6 | Scope v1 | **Me + Journal (New/history) + Stage styles + Creation→journal** | Full Day One clone (maps, streaks, multi-notebook) |
| C7 | Creation → journal | **Every new My Creation auto-writes into that day’s journal** (append if today already has an entry) | Stage media only; or ask each time |

Reply with “defaults OK” or change C1–C7. After that we implement.

---

## 1. What industry journals get right (and what Spark must not copy)

Successful products: [Day One](https://dayoneapp.com/), [Journey](https://journey.cloud/), [Apple Journal](https://www.apple.com/journal/). Pattern summary:

| Pattern | Why it works | Spark take |
|---------|--------------|------------|
| **New entry (+)** always visible | Day One tinted `+`; Journey “start a new entry” | **New journal** = new dated entry (default today; optional other date) |
| **History / timeline list** | Journey Timeline; Day One calendar+list | **Full history**, newest first, grouped by month — not only a 7-day strip |
| **Calendar + timeline**, not a file dump | Finding “last Tuesday” is the job | Month strip on Me; full month on Journal home |
| **Auto-import moments** | Apple Journal suggestions; Day One photo/Strava → entry | **My Creations auto-land in that day’s journal** |
| **Prompts / suggestions** | Apple Journal; Day One prompt packs | One kid-safe Spark question; Coach can go deeper |
| **Photos + voice + text** | Memory is multi-modal | Pad mic / camera / file + Creation media embed |
| **On This Day** | Long-term archive magic | v1.5: same calendar date last year / last month |
| **Private by default** | Journal is a sanctuary | No class feed; share is explicit |
| **AI as reflection, not rewrite** | Journey “Reflection” | Existing Spark Think-first Coach |

**Do not copy:** Apple Health / weather / GPS (creepy for kids); Liquid Glass; public social journals; streaks/badges; **multiple notebooks** (Work/Personal) — one journal per account is enough; a second full writing app.

Spark already has the writing muscle (pad, Coach, Stage, Creations). Journal is the **habit + archive**: New, history, and a place where made things also live.

---

## 2. Product model

```
Me (/me) ──open all──► Journal home                 Writing Studio
┌──────────────┐     ┌─────────────────────┐        ┌──────────────────────┐
│ Today prompt │     │ [+ New journal]     │  open  │ Type = Journal       │
│ Journal peek │     │ History (by month)  │ ──────►│ Pad + Coach          │
│ Creations 4  │     │ Calendar month      │        │ Stage: style+generate│
│ Chats · Dash │     └──────────▲──────────┘        └──────────┬───────────┘
└──────────────┘                │                              │
                                │ auto-append today’s entry    │ addCreation
                     My Creations ─────────────────────────────┘
                     song / image / video / TED / NatGeo / …
```

**One account = one journal + one creations library + one chat history.** Switching accounts switches Me + Journal + Creations.

### 2.1 Journal vs Writing Pad vs Creations

| Object | What it is | Primary verb |
|--------|------------|--------------|
| **Journal entry** | Dated private record (prose and/or attached creations) | Remember |
| **Writing pad draft** | Ephemeral working text (any writing type) | Coach / Structure |
| **Creation** | Artifact in My Creations | Keep / share |

**Two ways an entry appears**

1. Student taps **New journal** (or Write today) → writes in Studio → Save.
2. Student **makes a Creation** → system writes that content into **today’s journal** (see §5.1). My Creations stays the gallery; Journal is the dated story.

A day may have **1–N entries** (a morning write + an afternoon song). If they already wrote today, a new Creation **appends a “Made” block** to that entry instead of spawning a second empty day.

### 2.2 Writing type

Add `journal` to `WritingType`:

`journal | narrative | persuasive | descriptive | expository | poetry | lyrics | free`

- Journal: coach focuses on feelings + one concrete moment (existing writing Think-first), **not** essay structure.
- Structure CTA: **Stage this day** (still song / image / video).
- Mood/genre **not** on the pad for journal (feelings are the content; style lives on Stage).

---

## 3. UI — Journal (industry-shaped: New + history)

Journal is a **first-class surface**, not only a Me widget. Me shows a peek; **Open all** goes to Journal home.

### 3.1 Journal home (`/me/journal` or `/journal`)

Day One / Journey reduced for kids — **no inner tabs**, one column:

```
┌─────────────────────────────────────────────┐
│  Journal · 日记          Ching              │
│  [ + New ]     [ Write today ]              │
│  prompt: “What almost went unsaid?”         │
├─────────────────────────────────────────────┤
│  August 2026                    [◀ month ▶] │
│  Su Mo Tu We Th Fr Sa                       │
│           1  2  3  4  5   · dots = has entry│
├─────────────────────────────────────────────┤
│  HISTORY                                    │
│  12 Aug  Wed                                │
│    · What I noticed on the way home         │
│    · ♪ Made · Hold the light  (Hip-hop)     │
│  11 Aug  Tue                                │
│    · TED · Why we sleep                     │
│  July 2026                                  │
│    · …                                      │
└─────────────────────────────────────────────┘
```

| Control | Behavior |
|---------|----------|
| **+ New** | New entry dated **now** (today). Opens Writing Studio `writingType=journal`. Can backdate via a small date chip before save (forgot yesterday). |
| **Write today** | If today already has a prose entry → open it; else same as New for today. |
| **Calendar** | Tap a day with a dot → filter history to that day; empty day → New for that date. |
| **History list** | Newest first, grouped by month. Row = title · 2-line preview · media/creation thumbs. Tap → open (Studio if student-written; read view if Creation-only). |
| **Empty** | “Nothing yet. Tap New — one honest sentence is enough.” |

Me hub keeps a **7-day strip + last 3 rows** and **Open all → Journal home**. Do not put the full archive on Me.

**Not in v1:** multiple notebooks, search, map, streak, On This Day.

### 3.2 Editor = Writing Studio

Opening an entry:

```
/entertain?hub=studio&game=writing-studio&journal=je_<id>
```

or new day:

```
…&writingType=journal&date=2026-08-12
```

Pad loads entry body; Coach + grammar behave as now; Stage is optional.

**Save journal** is a first-class action (beside Coach): persists even if Stage is empty. Autosave debounce ~2s while focused (like a notes app), plus explicit Save.

### 3.3 Prompt examples (grade-aware, not babyish)

| Band | Example |
|------|---------|
| G1–G4 | “What is one thing you noticed on the way home?” |
| G5–G8 | “What felt unfair or kind today — what happened first?” |
| G9–G12 | “What did you almost not say out loud?” |

Coach may ask **one** follow-up after they write. Never auto-rewrite the diary.

---

## 4. UI — Me hub (`/me`) — **recommended yes**

### 4.1 Why a personal main page

Today personal things are scattered:

| Thing | Where it lives now |
|-------|-------------------|
| Profile / grade | `/account` (settings form) |
| Learning | `/dashboard` |
| Chat | `/` + sidebar history |
| Creations | Studio → My Creations |
| Journal | **does not exist** |

Parents and kids already ask “where is *my* stuff?”. A Me hub reduces that without turning Spark into EdTech-with-six-dashboards.

### 4.2 Why not replace the homepage

DESIGN.md: conversation is the core; a 9-year-old should not hunt a dashboard to start homework. **Keep `/` as chat.** Me is an opt-in home base from the sidebar (next to Family / Dashboard).

### 4.3 Layout (one scroll, no inner tabs)

```
┌──────────────────────────────────────────┐
│  [Avatar] Ching · G10          [Account] │
│  Write today · “What almost went unsaid?”│
├──────────────────────────────────────────┤
│  Journal     12 Aug  ·  11 Aug  ·  10 …  │
│              [Open all → history]        │
├──────────────────────────────────────────┤
│  Made        song · video · image thumbs │
│              [My Creations]              │
├──────────────────────────────────────────┤
│  Chats       last 3 sessions             │
│              [All chats → / ]            │
├──────────────────────────────────────────┤
│  Learning    1–2 subject chips + link    │
│              [Dashboard]                 │
└──────────────────────────────────────────┘
```

Mobile: same stack, large tap targets. Desktop: max-width ~40rem, not a 3-column CMS.

### 4.4 Sidebar

Add **Me** on the Family | Dashboard row (or replace the weak “Account” mental model):

`Family | Me`  
`Studio | Entertainments`

`/account` stays linked from Me header **Account** (settings only).

### 4.5 “My Chat”

Do **not** fork a second chat product. Me shows **recent conversation titles** from existing `history-store` (same account). Tap → `/` with that `session` query. Full history remains the sidebar.

---

## 5. Writing Studio × Journal × Creations

| Direction | Behavior |
|-----------|----------|
| Me / Journal home → Studio | **New** / Write today / tap a written entry → pad `writingType=journal` + date |
| Studio → Journal | Type Journal or **Save in journal** → upsert store (autosave + Save) |
| Studio → Stage | **Structure** returns lyrics/prompt **and** `suggestedStyle` → Stage dropdown prefilled; student may change |
| Stage → Creations | Existing `addCreation` |
| **Creations → Journal** | **On every successful Keep / save Creation, write content into that day’s journal** (§5.1) |
| Journal → Creations | Entry shows playable/viewable media + “Open in My Creations” |
| Coach | Journal: Think-first (praise → one question → wait) |

**Save in journal** from non-journal pad types: copies pad into a new (or today’s) entry tagged `from: writing-studio`. Does not delete the pad.

### 5.1 Creation auto-journals (C7)

Industry analog: Apple Journal moments / Day One “add from library” — made things become dated memories without a second save.

When `POST /api/creations` succeeds (song, image, video, TED / NatGeo / BBC / RSA challenge):

1. Resolve **today** in the student’s local date.
2. If a journal entry for today already exists → **append** a `Made` block (do not overwrite their prose).
3. Else → **create** an entry `source: creation` with that block as the body.
4. Snapshot enough to read the diary **even if** they later delete the Creation card (soft copy, not only a foreign key).

**Made block (stored + rendered)**

| Field | Example |
|-------|---------|
| `kind` | `song` / `image` / `video` / `ted_challenge` / … |
| `creationId` | `cr_…` (optional after delete) |
| `title` | Hold the light |
| `style` | Hip-hop (if Stage) |
| `bodySnapshot` | lyrics or visual prompt or challenge notes (cap ~2k chars) |
| `mediaId` / `audioMediaId` | same blob as Creations (do not duplicate bytes) |
| `at` | timestamp |

History row: `♪ Made · Hold the light`. Opening it shows lyrics/prompt + player + original prose above if any.

**Delete rules:** deleting a Creation does **not** delete the journal block (memory stays; player may show missing). Deleting a journal entry does **not** delete the Creation. Unlink only.

**Not auto-journaled:** chat turns, Code Agent, grammar-only pad edits.

---

## 6. Stage styles (song / image / video)

### 6.1 Problem

Music mood (`Indie` / `Orchestral` / `Hip-hop sketch` / `Ballad`) currently sits on the **pad toolbar**, and only when writing type is Lyrics or Poetry. After P0, essays hide it — Stage generate often uses leftover “Indie”, and the student cannot pick Hip-hop where they actually generate.

Style belongs with **Structure / Generate**, not with **draft type**.

### 6.2 Move into Stage + Structure suggests a default

```
Pad (write)  →  [Structure]  →  Stage
                                  lyrics/prompt filled
                                  Style dropdown = suggested (from those lyrics)
                                  student may change  →  [Generate]
```

**After Structure succeeds:**

1. Stage body + caption fill as today (adapted lyrics / visual prompt).
2. API also returns `suggestedStyle` (one of the Stage presets).
3. Stage **Style** control is set to that value (and caption seeded if empty).
4. Student can change Style any time before Generate; Generate uses the **current** dropdown, not the original suggestion.
5. Next Structure click **re-suggests** from the new lyrics (overwrites the dropdown). If they only edit lyrics by hand without Structure, style stays until they change it.

Suggestion sources (implementation later):

| Kind | How default is chosen |
|------|------------------------|
| Song | Coach/structure model names a style from lyric tone (rhyme density / energy / tender vs boast). Local fallback: writing type Lyrics + punchy short lines → Hip-hop; long vowel / “heart/night” → Ballad; otherwise Indie. |
| Image | Motifs (nature → Watercolor; people/scene → Photo; high contrast action → Comic). |
| Video | Song-like draft → Music video; observational prose → Documentary; else Playful. |

Never block Structure if suggestion fails — fall back **Indie** (song) / **Photo** (image) / **Playful** (video).

### 6.3 Stage controls

After Song / Image / Video toggle + title:

**Song**

| Control | Options (v1) |
|---------|----------------|
| Style | Indie · Hip-hop · Ballad · Orchestral · Folk · Electronic |
| Vocal | Female · Male (already there) |

Changing Style updates caption prefix (`Hip-hop mood, clear vocal…`) unless the student has edited caption since the last Structure.

**Image**

| Style | Prompt hint |
|-------|-------------|
| Photo | naturalistic still, soft light |
| Watercolor | kids-book wash |
| Comic | bold ink + flat color |
| Film still | cinematic grade |

**Video**

| Style | Prompt hint |
|-------|-------------|
| Playful | light, tracking, daylight |
| Documentary | observational, slower |
| Music video | rhythmic cuts (still one clip) |
| Quiet | single push-in, dusk |

### 6.4 Pad toolbar after the move

Keep: **writing type** · **mic language** · mic/file/camera · Coach · Structure.  
Remove: mood/genre dropdown from pad. Structure CTA still expands Stage.

---

## 7. Data & APIs (design)

Per-account, same isolation as creations (`data/accounts/{accountId}/`).

```
data/accounts/{id}/journal.json
data/media/journal_*     // optional photos, sessionId: "journal"
```

```ts
type JournalMadeBlock = {
  kind: CreationType;
  creationId?: string;
  title: string;
  style?: string;
  bodySnapshot: string;
  mediaId?: string;
  audioMediaId?: string;
  at: number;
};

type JournalEntry = {
  id: string;              // je_…
  accountId: string;
  date: string;            // YYYY-MM-DD (local student day)
  createdAt: number;
  updatedAt: number;
  title?: string;
  body: string;            // student prose (may be empty if Creation-only)
  prompt?: string;
  source: "student" | "creation" | "mixed";
  photoMediaIds?: string[];
  made: JournalMadeBlock[];
  writingType?: "journal" | WritingType;
};
```

| API | Role |
|-----|------|
| `GET /api/journal?accountId=&month=` | History + calendar dots |
| `GET /api/journal/:id` | One entry + made blocks |
| `PUT /api/journal/:id` | Upsert prose (autosave) |
| `POST /api/journal` | **New** entry (optional `date`) |
| `POST /api/journal/from-creation` | Internal: called from creations POST |
| `DELETE /api/journal/:id` | Delete entry (Creations untouched) |

Family read: `GET` allowed when parent PIN session is unlocked; `PUT/DELETE` still student account only.

Cap: 400 entries / account (oldest stay, warn before delete). Photos reuse `writeMediaBytes` + **never prune** (`sessionId: "journal"` next to `writing-studio`).

Cross-device: server JSON like creations — same host + same account = same journal (no localStorage-only diary).

---

## 8. Privacy & child safety

- Default **not listed** on Studio hub as a public gallery.
- Share link (Creations-style) **off** for raw diary text in v1. Staged song/video can still use existing share.
- Family: read-only digest optional later (“Ching wrote 4 days this week”) without showing body until PIN.
- Coach/LLM sees entry body only for that turn; do not dump diaries into learning-memory verbatim (store a one-line “journaled” outcome like other Studio turns).

---

## 9. What we explicitly will not build in v1

- Mood graphs, maps, streaks, shared family journals, **multiple notebooks**
- Separate rich-text journal editor (Studio is the editor)
- Replacing homepage chat with Me
- Auto-posting diary **to** Creations (the arrow is Creation → journal only)
- Public “class journal”
- Asking “also save to journal?” on every generate (C7 is automatic)

---

## 10. Implementation slices (after confirmation)

| ID | Slice | Depends |
|----|--------|---------|
| JM.0 | This spec confirmed (C1–C7) | — |
| JM.1 | Stage styles in Stage; **Structure → `suggestedStyle` default**; pad genre removed | C5 |
| JM.2 | Journal store/API + **New** + **history list** + calendar dots + `journal` type | C2 |
| JM.3 | Me page `/me` + sidebar + peek + Open all | C1 |
| JM.4 | **Creation save → append/create today’s journal** + snapshots | C7, JM.2 |
| JM.5 | Family read-only + On This Day | C3 |

JM.1 can ship alone if Me/journal is deferred.

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Me becomes a sixth dashboard | One scroll; 4 small sections; chat stays `/` |
| Two editors confuse kids | Journal **is** Writing Studio |
| Diary deleted by chat media prune | Reserved `sessionId: "journal"` |
| Stage styles ignored by models | Merge current dropdown into caption/prompt |
| Structure overwrites a careful style pick | Expected: Structure re-suggests; change again before Generate |
| Creation delete erases memory | Journal keeps `bodySnapshot`; player may be missing |
| Double-save noise | Append to today’s entry; no extra modal |
| Philosophy clash (“no dashboard”) | Me is a locker; Journal home is a list, not analytics |

---

## 12. Open questions (optional)

- Default Me vs Chat after account switch? **Recommend stay on current page.**
- Chinese UI copy for Journal (“日记” vs “Journal”)? **Recommend bilingual label: Journal · 日记**
- Should Studio hub gain a Journal card? **Recommend no** if Me exists; Journal home is the third click from Me → Open all.
- Backdate New entries? **Yes, optional date chip** (industry standard; kids forget yesterday).
- Auto-journal TED/NatGeo as well as songs? **Yes (C7)** — all My Creations types. Say if Stage-only.
