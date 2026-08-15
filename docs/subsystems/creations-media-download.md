## Creations media download (My Creations)

**Date:** 2026-08-15  
**Status:** shipped (pending deploy)

### Problem
My Creations already has **Share link** for songs / videos / images, but music videos (and other Stage media) cannot be saved to the device. Users expect a **Download** action next to share.

### Approach
Reuse existing `GET /api/media/:id?download=1`, which sets `Content-Disposition: attachment` (inline playback stays disposition-free so `<video>`/`<audio>` keep working).

1. Pure helper: resolve downloadable `mediaId` + URL from a `CreationItem`.
2. **My Creations** (`CreationsLibrary`): **Download** button beside **Share link** when media exists and is not missing.
3. **Public share page**: same Download for recipients of a share link (video primary; song/image included for parity).
4. Prefer navigational `<a href="…?download=1">` over fetch→blob (large MP4s; lower memory).

### Key files
- `src/lib/entertain/creation-download.ts` — URL / eligibility helpers + unit tests
- `src/components/CreationsLibrary.tsx` — Download UI
- `src/app/share/c/[token]/ShareCreationClient.tsx` — Download on share page
- `src/app/api/media/[mediaId]/route.ts` — already supports `download=1` (no API change expected)

### Risks
- Mobile Safari may open the file in a new tab instead of “Save”; `download=1` + attachment header is still the standard fix.
- Missing media: hide Download (same gate as Share).
- Filename: media-store `name` / MIME fallback via existing `buildContentDisposition`.

### Test design
| Layer | Cases |
|-------|--------|
| Unit | `creationDownloadUrl` → song uses `audioMediaId`, video/image use `mediaId`, missing/TED → null |
| Unit | URL always ends with `?download=1` and encodes mediaId |
| Unit (existing) | media GET `download=1` → `Content-Disposition: attachment` |
| Manual | Keep video → My Creations → Download saves MP4; Share link still copies; share page Download works |
