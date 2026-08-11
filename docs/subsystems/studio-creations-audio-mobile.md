## 6.7 Studio audio prune bug (2026-08-11)

### Problem
My Creations songs show an `<audio>` control but **do not play** (esp. on mobile). Live probe: creation `audioMediaId=song_…` → `GET /api/media/{id}` **404**. No `song_*.bin` remain under `data/media/`.

### Root cause
Studio generate persists audio via `writeMediaBytes` with `sessionId: "writing-studio"`. Chat retention (`enforceServerRetention` → `pruneOrphanMedia`) only keeps chat session IDs + message attachment mediaIds. After the 2‑minute grace window, studio audio is treated as an orphan session and **deleted**, while `creations.json` still references the dead id.

Desktop and mobile both fail to decode; native mobile players make the failure more obvious.

### Approach
1. **Never prune** media whose `sessionId` is a reserved studio id (`writing-studio`).
2. **Never `deleteMediaForSession`** for those reserved ids.
3. On creation delete, also delete `audioMediaId` / `mediaId` blobs.
4. Serve audio/video with **HTTP Range (206)** + `Accept-Ranges: bytes` so iOS Safari can seek/play once bytes exist.
5. Creations UI: `playsInline` + load-error hint when media 404s.

### Key files
- `src/lib/media-store.ts` — protect studio sessions in prune/delete
- `src/lib/history-store.ts` — (caller unchanged; fix is in prune)
- `src/app/api/media/[mediaId]/route.ts` — Range support
- `src/app/api/creations/route.ts` — delete media with creation
- `src/components/CreationsLibrary.tsx` — mobile-safe player + error
- Tests: `media-store.test.ts`, `route.audio.test.ts`, creations delete test

### Risks
- Studio media no longer auto-GC’d by chat retention → cap creations at 100 already; delete path must free blobs.
- Existing broken songs need re-generate (bytes already gone).

### Test design
| Layer | Cases |
|-------|--------|
| Unit | prune keeps `writing-studio` audio even when session not in keepIds |
| Unit | `deleteMediaForSession("writing-studio")` is a no-op when protected |
| Unit | media GET honors `Range: bytes=0-1` → 206 + Content-Range |
| Unit | DELETE creation removes associated media files |
| Manual | Generate song → wait >2 min + sync a chat → audio still plays on phone |

## Release status (2026-08-11)

ENT-AUDIO.1–.6 shipped on `develop` (`c7ec387`); ENT-AUDIO.7 remains manual phone re-generate.
