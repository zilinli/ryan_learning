# AUDIT8.7 / AUDIT8.8 — Code Agent child-safe + STT/TTS lazy groups

> Status: **shipped** · 2026-08-11  
> Parent: [product-audit-2026-08-roadmap.md](product-audit-2026-08-roadmap.md) Slice F + G  
> Constraints: **keep all languages**; **keep Code Agent** full pipeline.

## Problem

1. **Slice F** — Kids can open Code Agent and ask for publish/deploy/revert. Diff Apply already has `PinGate`, but free-text prompts that trigger `publish_develop` / `deploy_live` / `revert_changes` did not. Hint chips were generic “vibe coding” lines, not clearly safe/parent-facing.
2. **Slice G** — All 12 voices render in one menu. We must **not** remove languages; we only defer showing the long tail until “More languages”.

## Approach

### AUDIT8.7 — Safe suggestions + PIN for destructive

| Piece | Behavior |
|-------|----------|
| `console-safe-intent.ts` | `SAFE_SUGGESTIONS` chips; `looksDestructive(text)` for push/deploy/revert/wipe patterns (EN + 中文) |
| `CodeAgentPanel` | Before `POST /api/console/chat`, if destructive **and** parent session not unlocked → `PinGate`; unlock then send |
| Diff **Apply** | Reuse session unlock: skip PIN if already unlocked |

Non-goals: server-side tool ACL (agent tools still available after parent unlock); gutting the agent.

### AUDIT8.8 — Voice menu lazy groups

| Piece | Behavior |
|-------|----------|
| `voice-menu-groups.ts` | `CORE_VOICE_IDS` = auto / 粤 / en Ryan / 普; `MORE_VOICE_IDS` = es/fr/ms/teo/hak/sha + Ava/Jorge |
| `VoiceControls` | Menu shows Core always; **More languages** expands the rest (zero deletions) |

True network lazy-load of TTS providers remains future work (edge/Bailian already on-demand per request).

## Key files

- `src/lib/console-safe-intent.ts` (+ test)
- `src/components/CodeAgentPanel.tsx`
- `src/lib/voice-menu-groups.ts` (+ test)
- `src/components/VoiceControls.tsx`

## Risks

| Risk | Mitigation |
|------|------------|
| False-positive PIN on “deploy a homework tip” | Match tool names + clear ops verbs only |
| Kids never find dialect voices | “More languages” label + keep all ids in MORE |

## Test design

### Unit
- `console-safe-intent.test.ts` — destructive EN/中文; safe chips non-destructive; unlocked skips gate helper
- `voice-menu-groups.test.ts` — core ∪ more = all TUTOR_VOICES; no id missing

### Manual
- Code Agent: chip send without PIN; “publish to develop” → PIN → send
- Voice menu: Core 4 visible; expand → Hokkien/Hakka/Shanghainese still present
