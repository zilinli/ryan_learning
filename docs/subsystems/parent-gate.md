# Parent gate — usability + child protection

Industry references: YouTube Kids adult gate, Google [Building for Kids](https://developers.google.com/building-for-kids/designing-engaging-apps) “gate parental controls”, Apple Screen Time / Family Link (session-style unlock, hard bypass).

## Product rules we follow

| Principle | Spark behavior |
|-----------|----------------|
| Don’t bury parent tools | Sidebar **Parents** button (teal) |
| Adult-only gate | 4-digit PIN; auto-advance on 4th digit |
| Don’t nag | Unlock lasts for the **browser tab** (`sessionStorage`) |
| Kids can’t one-tap reset | Forgot PIN → **adult math/year challenge** → then set new PIN |
| Hand device back | Explicit **Lock now** clears session unlock + turns off check mode |
| Separate surfaces | Student Learning panel ≠ parent digests / export / check mode |

## Files

- [`parent-pin.ts`](../../src/lib/parent-pin.ts) — PIN hash + session unlock
- [`adult-gate.ts`](../../src/lib/adult-gate.ts) — adult challenge generator
- [`PinGate.tsx`](../../src/components/PinGate.tsx) — keypad + adult reset
- [`ParentSettingsSheet.tsx`](../../src/components/ParentSettingsSheet.tsx) — parent hub
