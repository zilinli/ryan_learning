# Upload size limit → 256MB

> **Subsystem** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipping** · 2026-08-14  
> Related: [document-upload-parse.md](document-upload-parse.md) · [short-video-upload-parse.md](short-video-upload-parse.md)

---

## Problem

Per-file upload is capped at **12MB** (`MAX_FILE_BYTES`). Students / builders hit the wall on larger PDFs, Office decks, and phone videos. Nginx (`client_max_body_size 50m`) and Next.js body buffering (default ~10MB via `proxyClientMaxBodySize`) would still reject a true 256MB payload even if the app constant alone changed.

Attachments travel as **base64 inside JSON** (~1.33× raw size), so a 256MB file needs ~340MB+ request body headroom.

## Approach

1. **App constant** — Raise `MAX_FILE_BYTES` to `256 * 1024 * 1024` in `src/lib/attachments.ts` (+ `agent-chat` parity). Derive UI/error copy from the constant (no hardcoded "12MB").
2. **Next.js** — Set `experimental.proxyClientMaxBodySize` and `serverActions.bodySizeLimit` to **`512mb`** so buffered JSON bodies fit one 256MB file after base64.
3. **Nginx (host)** — `/etc/nginx/conf.d/spark.conf`: `client_max_body_size 512m`; bump `client_body_timeout` for slow uplinks. Reload nginx as part of deploy (not in git).
4. **Out of scope** — Do **not** change `MAX_HISTORY_BYTES` (history store) or mic `/api/transcribe` 12MB clip (voice blobs, not file picker).

## Key files

| File | Change |
|------|--------|
| `src/lib/attachments.ts` | `MAX_FILE_BYTES` → 256MB; export `MAX_FILE_MB` |
| `src/lib/file-payload.ts` | Error text uses `MAX_FILE_MB` |
| `src/lib/extract-files.ts` | Video fail hint uses new limit |
| `agent-chat/src/lib/attachments.ts` | Parity |
| `next.config.ts` | `proxyClientMaxBodySize` + `serverActions.bodySizeLimit` = 512mb |
| `/etc/nginx/conf.d/spark.conf` | `client_max_body_size 512m` (ops) |
| `docs/subsystems/short-video-upload-parse.md` | Note shared size ceiling |

## Risks

- **Memory** — Base64 doubles peak RAM (browser + Node). Low-RAM hosts may OOM on multi-file large uploads; still enforce `MAX_ATTACHMENTS` (9) but nginx 512m effectively caps **total request** ≈ one large file.
- **Latency** — Slow networks need longer `client_body_timeout` / chat `maxDuration` (chat already 300s).
- **Ops drift** — Nginx lives outside the repo; forgotten reload leaves 413 while app says 256MB.

## Test design

| ID | Layer | Case |
|----|-------|------|
| UP-1 | unit | `MAX_FILE_BYTES === 256 * 1024 * 1024` and `MAX_FILE_MB === 256` |
| UP-2 | unit | `fileToAttachment` rejects a File with `size > MAX_FILE_BYTES` and message mentions `256MB` |
| UP-3 | unit | File at `MAX_FILE_BYTES` is not rejected for size (may still fail unsupported type) |
| UP-4 | manual | Upload ~15–50MB PDF/video through Tutor → no 413; model sees extract/summary |
| UP-5 | manual | File &gt;256MB → client error before send |
