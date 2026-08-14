# Short video upload & parse

> **Subsystem** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipping** · 2026-08-13  
> Related: [document-upload-parse.md](document-upload-parse.md) · [bailian-stt-tts.md](bailian-stt-tts.md) · [voice-tts-stt.md](voice-tts-stt.md)

---

## Problem

Tutor / Code Agent / Ask AI already accept photos and documents (PDF / Office / MD / HTML). Students also send **short phone videos** (screen-record a worksheet step, explain a problem out loud, TikTok-length clips). Those files are rejected by the allowlist, so the model never sees speech or on-screen text.

Cursor SDK multimodal input is **images only** (`SDKImage`) — raw `video/mp4` cannot be passed through. We need a **server extract → text (+ optional frame OCR)** path, same pattern as PDF/Office summaries.

## Approach

1. **Allowlist** — Short clips only: `.mp4` / `.webm` / `.mov` / `.m4v` + `video/*` MIME. Per-file ceiling follows shared `MAX_FILE_BYTES` (**256MB**; see [upload-size-limit-256mb.md](upload-size-limit-256mb.md)).
2. **Client payload** — Binary base64 (same as PDF/Office); never `readAsText`. Preview pill uses a 🎬 label (no autoplay in chat).
3. **Server extract** (`extractVideoSummary`):
   - Write temp file → **ffprobe** duration (informational)
   - **ffmpeg** → 16 kHz mono WAV → existing STT chain (Bailian Fun-ASR / Qwen3-ASR → local Whisper)
   - **ffmpeg** → up to **3 JPEG keyframes** (≈10% / 50% / 90% of duration, or 0.5s / mid / near-end for very short clips)
   - Run existing **Qwen-OCR** on frames when `ALIYUN_DASHSCOPE_API_KEY` is set (silent screen recordings)
   - Build a capped (12k) text block: duration + transcript + per-frame OCR
4. **Prompt injection** — Wire into `buildFileSummaries` so Tutor / Console / Ask AI all see the summary without route-specific forks.
5. **UI accept** — Extend `FILE_INPUT_ACCEPT` / `CONSOLE_FILE_INPUT_ACCEPT`. iOS still uses `accept="*/*"` + client allowlist.

**Out of scope (v1):** full multimodal video to Gemini/Qwen-VL; long-form (>~3–5 min) lecture dumps; streaming upload; storing video in media vault.

## Key files

| File | Change |
|------|--------|
| `src/lib/attachments.ts` | Video allowlist, `isVideoAttachment`, MIME normalize, accept string |
| `src/lib/file-payload.ts` | Video → base64; clearer unsupported error |
| `src/lib/extract-video.ts` | **New** — ffmpeg / ffprobe + STT + frame OCR |
| `src/lib/extract-files.ts` | Call video extractor in `buildFileSummaries` |
| `src/components/Composer.tsx` (etc.) | Optional 🎬 pill (kind stays `file`) |
| `docs/DESIGN.md` | Link this subsystem |

## Risks

- **CPU / latency** — ffmpeg + STT can take 10–60s; chat already has `maxDuration = 300` and heartbeats.
- **Silent / music-only clips** — STT empty is OK if frame OCR catches text; otherwise honest “could not extract” message.
- **No ffmpeg** — Host has ffmpeg today; if missing, return clear failure (do not hang).
- **Payload size** — Base64 in JSON ≈ 1.33× file; nginx `client_max_body_size 512m` + Next `proxyClientMaxBodySize` cover one 256MB clip after encoding.
- **Privacy** — Same as mic STT: audio/frames go to Bailian when configured; only summary text enters the tutor prompt.

## Test design

| ID | Layer | Case |
|----|-------|------|
| VID-1 | unit | `isAllowedAttachment` / `isVideoAttachment` true for mp4/webm/mov/m4v |
| VID-2 | unit | Reject still for `.exe` / `.zip` / legacy `.avi` (v1) |
| VID-3 | unit | `normalizeMime` maps video extensions |
| VID-4 | unit | `FILE_INPUT_ACCEPT` includes `video/*` and `.mp4` |
| VID-5 | unit | `extractVideoSummary` with mocked ffmpeg/STT/OCR returns transcript + frame text |
| VID-6 | unit | Missing binary → honest extract-fail message in `buildFileSummaries` |
| VID-7 | unit | `fileToAttachment` path treats video as base64 `file` (no textContent) |
| VID-8 | manual | Tutor: upload phone mp4 (≤256MB) with speech → model cites transcript |
| VID-9 | manual | Silent screen-record of worksheet → OCR lines appear in reply context |
