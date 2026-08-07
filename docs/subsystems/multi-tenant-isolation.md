# Multi-Tenant Account Isolation Design

> Version 0.1 · August 2026
> Status: Design — data isolation for multi-student Spark usage
> References: Blockly profiles UX (Wonder Workshop), Khan Academy Kids multi-user,
>   localStorage namespace patterns (greatstorage, LSNS, persistme)

---

## 1. Motivation

Spark currently has a multi-account profile layer (`AccountsStore` → switchable profiles), but **all underlying data is shared across accounts**. Two siblings using the same device will see each other's chat history, learning progress, and engagement badges. The `AccountsStore` gives the illusion of isolation without delivering it.

### 1.1 What's Shared Today (all accounts see the same data)

| Data layer | storage key | Account-aware? |
|-----------|------------|:--:|
| Chat history | `spark-tutor-sessions-v3` | No |
| Learning memory (BKT) | `spark.learningMemory` | No |
| Engagement (streaks, badges) | `spark.engagement` | No |
| TTS voice preference | `spark.ttsVoice` | No |
| Dark mode | `spark.dark` | No (should stay shared) |
| Parent PIN | `spark.parentPin` | No (should stay shared) |
| Accounts store | `spark.accounts.v1` | Yes (the only one) |

### 1.2 What's Isolated Today

Only the **profile metadata** (name, grade, school, curriculum) is per-account. Everything that matters — learning state, conversation history, practice streaks — is a single global bucket visible to every account.

### 1.3 Goal

True multi-tenant isolation: each account gets its own learning memory, chat history, and engagement state. Switching accounts completely swaps the student's experience. Default login = Ryan (backward compatible). Non-Ryan accounts start fresh with grade-appropriate defaults.

---

## 2. Design Philosophy

```
┌─────────────────────────────────────────────────────┐
│                    Spark App (origin)               │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │    Ryan (G4)      │  │    Emma (G8)      │        │
│  │  ┌──────────────┐│  │  ┌──────────────┐│        │
│  │  │ Chat history ││  │  │ Chat history ││        │
│  │  │ BKT skills   ││  │  │ BKT skills   ││        │
│  │  │ Engagement   ││  │  │ Engagement   ││        │
│  │  │ Voice pref   ││  │  │ Voice pref   ││        │
│  │  │ Profile      ││  │  │ Profile      ││        │
│  │  └──────────────┘│  │  └──────────────┘│        │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│  Shared (cross-tenant): dark mode, parent PIN       │
└─────────────────────────────────────────────────────┘
```

Three design levels:

1. **Profile isolation** (already done in Phase 12E) — name, grade, school, curriculum are per-account
2. **Data isolation** (this design) — learning memory, chat history, engagement, voice preferences are per-account
3. **Server isolation** (this design) — `/api/learning`, `/api/history` respect account boundaries

### 2.1 Key Design Decision: Local-first, No Auth

Spark is a **local-first PWA** with server sync as a convenience layer. We are **not** adding login/password/email auth. Accounts are local identifiers on the device.

This is intentional and practical:
- Family iPad shared by 2-3 kids — no email addresses, no passwords
- Classroom tablet shared by 4-5 students — quick switch without sign-in
- Ryan is the default — zero friction for the primary use case

The server sync API will gain an optional `accountId` field. When absent, it defaults to `"default"` (backward compatible with all existing server data).

---

## 3. Namespace Strategy

### 3.1 localStorage Key Pattern

Every per-tenant key follows: `spark.{accountId}.{module}`

| Module | Current Key (flat) | New Key (namespaced) |
|--------|-------------------|---------------------|
| Chat sessions | `spark-tutor-sessions-v3` | `spark.{accountId}.sessions.v1` |
| Learning memory | `spark.learningMemory` | `spark.{accountId}.memory.v1` |
| Engagement | `spark.engagement` | `spark.{accountId}.engagement.v1` |
| TTS voice | `spark.ttsVoice` | `spark.{accountId}.ttsVoice.v1` |
| Student profile | `spark.studentProfile.v2` | `spark.{accountId}.profile.v2` |
| Accounts store | `spark.accounts.v1` | `spark.accounts.v1` (shared) |
| Dark mode | `spark.dark` | `spark.dark` (shared) |
| Parent PIN | `spark.parentPin` | `spark.parentPin` (shared) |

### 3.2 Namespace Resolver

```typescript
// New file: src/lib/tenant-storage.ts

function nsKey(accountId: string, module: string): string {
  return `spark.${accountId}.${module}.v1`;
}

// Shared keys (no accountId prefix)
const SHARED_KEYS = [
  "spark.accounts.v1",
  "spark.dark",
  "spark.parentPin",
] as const;
```

All read/write operations go through a thin `TenantStorage` wrapper that auto-injects the `accountId` prefix for tenant-scoped keys. Shared keys bypass the prefix.

### 3.3 Migration from Flat Keys → Namespaced Keys

On first launch after upgrade:

1. Read the active account ID from `spark.accounts.v1`
2. Check if `spark.{accountId}.memory.v1` exists
3. If NOT (first time after migration):
   - Read flat `spark.learningMemory` → write to `spark.{accountId}.memory.v1`
   - Read flat `spark-tutor-sessions-v3` → write to `spark.{accountId}.sessions.v1`
   - Read flat `spark.engagement` → write to `spark.{accountId}.engagement.v1`
   - Read flat `spark.ttsVoice` → write to `spark.{accountId}.ttsVoice.v1`
   - Keep flat keys as backup (do NOT delete — safety net)
4. New accounts (created after migration) start with empty namespaced keys

---

## 4. Data Isolation Matrix

### 4.1 Per-Tenant Data (isolated)

| Entity | Storage | Isolation mechanism | On switch |
|--------|---------|-------------------|-----------|
| Chat history | `nsKey(accountId, "sessions")` | localStorage namespace | Full reload of `ConversationsStore` |
| Learning memory | `nsKey(accountId, "memory")` | localStorage namespace | Full reload of `LearningMemory` |
| Engagement | `nsKey(accountId, "engagement")` | localStorage namespace | Full reload of `EngagementState` |
| TTS voice | `nsKey(accountId, "ttsVoice")` | localStorage namespace | Re-read voice preference |
| Student profile | `AccountsStore.accounts[i].profile` | In-account object | Already per-account |
| Session digests | Part of `LearningMemory` | Namespaced with memory | Auto-isolated |

### 4.2 Cross-Tenant Data (shared)

| Entity | Reason |
|--------|--------|
| Dark mode | Visual preference — shouldn't flash on switch |
| Parent PIN | Device-level gate, not per-kid |
| Accounts list | Must know all accounts to switch between them |

### 4.3 Server Sync Isolation

Server API endpoints need awareness of which account is syncing:

```typescript
// Current
GET  /api/learning          → returns single global memory
PUT  /api/learning          → writes single global memory
GET  /api/history           → returns single global conversation list
PUT  /api/history           → writes single global conversation list
DELETE /api/history?sessionId=...

// After MT isolation
GET  /api/learning?accountId=acct_xxx    → tenant-scoped memory
PUT  /api/learning                       → body includes { accountId, memory }
GET  /api/history?accountId=acct_xxx     → tenant-scoped conversations
PUT  /api/history                        → body includes { accountId, conversations }
```

Server storage layout:

```
data/
  learning/
    acct_ryan.json         ← Ryan's BKT state
    acct_abc123.json        ← Emma's BKT state
  history/
    acct_ryan/
      sessions.json         ← Ryan's conversation list
    acct_abc123/
      sessions.json         ← Emma's conversation list
  media/                    ← shared (images already keyed by mediaId)
```

---

## 5. Onboarding UX

### 5.1 First Launch (New Visitor)

```
┌──────────────────────────────────┐
│          ✨ Spark                 │
│                                  │
│   Your AI study buddy            │
│                                  │
│   ┌────────────────────────┐     │
│   │  👤 Ryan (Grade 4)      │     │
│   │  BASIS G4 · 9 years    │     │
│   │           [Start →]    │     │
│   └────────────────────────┘     │
│                                  │
│   ┌────────────────────────┐     │
│   │  ＋ Add another student │     │
│   └────────────────────────┘     │
└──────────────────────────────────┘
```

Default screen shows Ryan's card prominently. A single tap enters the tutor. The "+" button reveals the account creation form.

### 5.2 Creating a New Account

```
┌──────────────────────────────────┐
│  ← Back              New Student │
│                                  │
│   Name: [_______________]        │
│   Grade: [Grade 4 ▾]  1–12      │
│   School: [_____________] (opt)  │
│                                  │
│   Learning focus (pick up to 3): │
│   ☐ Math   ☐ Science             │
│   ☐ Reading ☐ Writing            │
│   ☐ General homework help        │
│                                  │
│   [Create account →]             │
└──────────────────────────────────┘
```

After creation, automatically switch to the new account's empty workspace. The student sees a fresh chat with grade-appropriate empty state messaging.

### 5.3 Account Switcher (in header)

```
┌──────────────────────────────────┐
│ ☰  ✨ Spark          👤 Ryan ▾  │  ← header
│──────────────────────────────────│
│                                  │
│  ┌──────────────────────────┐    │
│  │ 👤 Ryan    G4 · Current  │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ 👤 Emma    G8 · Switch   │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ ＋ Manage accounts       │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

Dropdown in header shows current account with a small avatar. Tap to open switcher popover. Switching accounts:

1. Save current account's state (memory, sessions, engagement)
2. Load target account's state
3. Clear chat thread
4. Navigate to new empty session for the switched account
5. Brief transition: "Switched to Emma (G8)" toast

### 5.4 Empty State per Account

Each account gets its own empty state message:

| Grade band | Empty state text |
|-----------|-----------------|
| early (K-2) | "Hi {name}! Ready to learn? Snap a photo of your worksheet or ask me anything!" |
| elementary (G3-5) | "Hi {name}! I can help with math, science, reading, and writing. Try sending a photo of your homework!" |
| middle (G6-8) | "Welcome back, {name}! I'm ready for algebra, biology, essay help, and more. What are we working on?" |
| high (G9-12) | "Ready when you are, {name}. AP prep, calculus, lab reports — just ask or share your work." |

---

## 6. UI Component Changes

### 6.1 New Components

| Component | Purpose |
|-----------|---------|
| `AccountSwitcher.tsx` | Header dropdown: current account + switch to others |
| `AccountCreator.tsx` | Full form: name, grade, school, subjects (→ AccountHome enhancement) |
| `AccountAvatar.tsx` | Small colored circle with initial letter |

### 6.2 Modified Components

| Component | Change |
|-----------|--------|
| `TutorShell.tsx` | Reads `accountId` from active account; passes to all data hooks |
| `AccountHome.tsx` | Enhanced: grade selector already exists; add school field; subject checkboxes |
| `CodeAgentPanel.tsx` | Gets `studentName` from active account (already wired) |
| `ConsoleThread.tsx` | Already accepts `studentName` prop (Phase 12E) |
| All data hooks | `loadLearningMemory()` → `loadLearningMemory(accountId)` |
| Server sync | All fetch calls include `accountId` param |

### 6.3 Data Hook Signature Changes

```typescript
// Before (flat, global)
export function loadLearningMemory(): LearningMemory { ... }
export function loadEngagement(): EngagementState { ... }
export function loadConversations(): ConversationsStore { ... }

// After (namespaced, per-tenant)
export function loadLearningMemory(accountId: string): LearningMemory { ... }
export function loadEngagement(accountId: string): EngagementState { ... }
export function loadConversations(accountId: string): ConversationsStore { ... }
```

---

## 7. Privacy & Parental Controls

### 7.1 Account Deletion

- Two-step confirmation: "Delete Emma's account?" → "This will permanently remove all of Emma's chat history, learning progress, and photos. This cannot be undone."
- Deletion clears all namespaced keys for that `accountId`
- Server-side: DELETE `/api/learning?accountId=...` and DELETE `/api/history?accountId=...`
- Ryan account cannot be deleted (only reset to defaults)

### 7.2 Parental PIN Gate

- The existing `PinGate` component gates access to Account Management (not just code changes)
- Account switching is PIN-free (kids can switch between themselves)
- Account creation requires PIN (parental gate)
- Account deletion requires PIN + confirmation

### 7.3 Data Export

- Per-account: export learning memory as JSON, export chat history as JSON
- Useful for parent review or transferring to a new device

---

## 8. Edge Cases

### 8.1 Device Sharing (Family iPad)

- 2-3 kids share one device → each has their own account
- localStorage namespacing naturally isolates them
- Server sync merges across devices sharing the same account
- `accountId` is the merge key on the server

### 8.2 Classroom Tablet (4-5 students)

- Quick-switch pattern: tap avatar in header, pick student
- Each student's session is independent
- Teacher can review progress per student (future: parent dashboard per account)

### 8.3 Same Student, Multiple Devices

- Ryan uses iPad at home + phone on the bus
- Server sync with `?accountId=acct_ryan` merges data across devices
- The merge algorithm (`mergeLearningMemory`, `mergeConversationLists`) already handles cross-device conflicts — just needs to scope to `accountId`

### 8.4 Account Count Limit

- Soft cap: 6 accounts per device (practical for family/classroom)
- localStorage quota: ~5MB per origin. With 6 accounts, ~800KB each
- Server storage: one JSON file per account, negligible

---

## 9. Implementation Strategy

### Principle: Ship in small, testable phases. Never break Ryan.

Each phase is independently shippable and has a dedicated regression gate.

### Phase A: Storage Abstraction Layer (4h)

Create `TenantStorage` wrapper. Convert all data modules to use it. Zero behavioral change — all data still goes to flat keys under the hood.

| # | Task | Effort | Files |
|---|------|--------|-------|
| MT-A.1 | Create `src/lib/tenant-storage.ts` — `nsKey()`, `TenantStorage` class with `get/set/remove/clear(accountId)` | 1h | `tenant-storage.ts` 🆕 |
| MT-A.2 | Update `learning-memory.ts` — `loadLearningMemory(accountId)`, `saveLearningMemory(accountId, mem)` | 1h | `learning-memory.ts` |
| MT-A.3 | Update `storage.ts` — `loadConversations(accountId)`, `saveConversations(accountId, store)` | 1h | `storage.ts` |
| MT-A.4 | Update `engagement.ts` — `loadEngagement(accountId)`, `saveEngagement(accountId, state)` | 0.5h | `engagement.ts` |
| MT-A.5 | Update `voices.ts` — voice preference per account | 0.5h | `voices.ts` |
| MT-A.6 | Regression test: all 37 test files pass with new signatures. Ryan's data still loads from flat keys (migration not yet active). | 0.5h | All test files |

### Phase B: Flat → Namespaced Migration (3h)

One-time migration that moves existing data into namespaced keys without deleting originals.

| # | Task | Effort | Files |
|---|------|--------|-------|
| MT-B.1 | `migrateToNamespacedKeys(accountId)` — read flat keys, write namespaced keys, set `spark.{accountId}.migrated` flag | 1.5h | `tenant-storage.ts`, `learning-memory.ts`, `storage.ts`, `engagement.ts` |
| MT-B.2 | `loadLearningMemory(accountId)` — check namespaced key first, fall back to flat key (with migration) | 0.5h | `learning-memory.ts` |
| MT-B.3 | Same fallback pattern for sessions, engagement, voice | 0.5h | `storage.ts`, `engagement.ts`, `voices.ts` |
| MT-B.4 | Migration test: create flat key → load with accountId → namespaced key exists, flat key untouched | 0.5h | `tenant-storage.test.ts` 🆕 |

### Phase C: Server-Side Multi-Tenant API (3h)

API routes scope data by `accountId`.

| # | Task | Effort | Files |
|---|------|--------|-------|
| MT-C.1 | `/api/learning` — accept `?accountId=` query param; read/write `data/learning/{accountId}.json` | 1h | `src/app/api/learning/route.ts` |
| MT-C.2 | `/api/history` — accept `?accountId=` query param; read/write `data/history/{accountId}/sessions.json` | 1h | `src/app/api/history/route.ts` |
| MT-C.3 | Server sync hooks — `hydrateLearningMemoryFromServer(accountId)`, `pushStoreToServer(accountId, store)` | 0.5h | `learning-memory.ts`, `history-sync.ts` |
| MT-C.4 | Backward compatibility: requests without `accountId` → use `"default"` key (preserves existing server data for Ryan) | 0.5h | Both route files |

### Phase D: Account Switcher UI (4h)

Header dropdown + account creation enhancement.

| # | Task | Effort | Files |
|---|------|--------|-------|
| MT-D.1 | `AccountSwitcher.tsx` — dropdown in `TutorShell` header showing current account + other accounts | 1.5h | `AccountSwitcher.tsx` 🆕, `TutorShell.tsx` |
| MT-D.2 | Enhance `AccountHome.tsx` — add school field and subject checkboxes (math/science/reading/writing) | 1h | `AccountHome.tsx` |
| MT-D.3 | `AccountAvatar.tsx` — colored circle with initial letter (e.g., "R", "E", "A") | 0.5h | `AccountAvatar.tsx` 🆕 |
| MT-D.4 | Wire account switch → reload all data hooks for new accountId | 1h | `TutorShell.tsx` |

### Phase E: Privacy & Polish (2h)

PIN-gate, deletion, empty states.

| # | Task | Effort | Files |
|---|------|--------|-------|
| MT-E.1 | Account deletion with two-step confirmation + PIN-gate | 1h | `AccountHome.tsx`, `PinGate.tsx` |
| MT-E.2 | Per-account empty state messaging (grade-band-appropriate) | 0.5h | `ChatThread.tsx`, `TutorShell.tsx` |
| MT-E.3 | Account limit enforcement (max 6) with friendly message | 0.5h | `AccountHome.tsx` |

---

### Phase F: End-to-End Validation (2h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| MT-F.1 | E2E test script: create G8 account, send message, verify chat isolated from Ryan | 1h | `scripts/verify-multi-tenant.mjs` 🆕 |
| MT-F.2 | Unit tests: TenantStorage namespace isolation, migration round-trip, deletion clears all keys | 0.5h | `tenant-storage.test.ts` |
| MT-F.3 | Regression: Ryan's full experience unchanged after all phases | 0.5h | Run full test suite |

---

## 10. Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking Ryan's existing data | Migration is **additive** — flat keys are never deleted, only read and copied. Regression test suite must pass at every phase boundary. |
| localStorage quota with 6 accounts | Engagement + TTS voice are tiny. Chat history has per-message character caps. Learning memory caps at 24 skills. Total per-account <200KB. |
| Server data mismatch after migration | Default `accountId` = `"default"` maps to existing server files. Ryan keeps his server data untouched. |
| Account switching feels slow | All data is in localStorage (synchronous read). Switch is instant. Server sync is async, non-blocking. |
| Kid deletes sibling's account | Deletion requires PIN + two-step confirmation. Ryan account cannot be deleted. |
| Multiple browser tabs with different accounts | localStorage is shared across tabs. Account switch in one tab updates `spark.accounts.v1.activeId`; other tabs detect `storage` event and reload. |

---

## 11. Migration Timeline

```
Phase A (4h) ──► Phase B (3h) ──► Phase C (3h) ──► Phase D (4h) ──► Phase E (2h) ──► Phase F (2h)
storage layer    data migration   server API       account UI       privacy          validation

Total: ~18h (2-3 days)
```

Each phase independently shippable. Phases A–C can be deployed without visible UI changes (backend-only). Phases D–E add the user-facing switcher and privacy controls.

---

## 12. References

- **Blockly profiles UX case study** (Wonder Workshop, 2025) — Card-based profile selector with avatars, color-coding, two-step deletion. Shows that 4-5 students per classroom device is the norm.
- **Khan Academy Kids** — "Grown-Ups Only" PIN gate for account management; kids freely switch between their own profiles. Animal avatars for younger users.
- **greatstorage** (npm) — Namespace prefix pattern: `prefix + separator + key`. `clear()` only removes entries in the current namespace.
- **LSNS convention** — Application code prefixes keys with root subpath. Libraries prefix with their domain. No central authority needed.
- **Shared iPad** (Apple, iPadOS 13.4+) — User partitions isolate apps, data, and preferences per student. Managed Apple ID for sign-in. Our localStorage namespace pattern mirrors this at the app level.
- **Local-first software** (Kleppmann et al.) — CRDTs and merge strategies for cross-device sync. Spark's `mergeLearningMemory` and `mergeConversationLists` already follow this pattern; scope to `accountId` is the only change.
