# 🔒 Security & Sanitization

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)

---

## Threat Model

| Vector | Risk | Mitigation |
|--------|------|------------|
| SVG XSS | `<script>`, `onload=`, `javascript:` | `sanitizeSvg` strips all |
| User HTML injection | `<iframe>`, `<script>` in input | react-markdown (no raw HTML) |
| API key leak | `CURSOR_API_KEY` in client | Server-side only; `.env.local` gitignored |
| Tool escape | Python/JS breakout | temp-only dir, 8s timeout, no network |
| SSRF | Internal network via `fetch_page` | Restrict to http/https, no private IPs |
| Path traversal | File read via crafted paths | `path.basename`/`path.resolve` guards |
| Public crawl / index | duckdns URL discovered via search | `robots.ts` Disallow `/` + metadata `noindex` |
| API key burn | Unbounded `/api/chat` etc. from internet | In-process `api-rate-limit` on costly routes |
| Meta overshare | GitHub URL in `<meta description>` | Scrubbed from public metadata |

> **Ops note (deferred):** For a public hostname, prefer Nginx Basic Auth, IP allowlist, or Tailscale in front of Spark — app-level PIN does not replace edge access control. See [claude-report-2026-08-feasibility.md](claude-report-2026-08-feasibility.md).

## SVG Sanitization Pipeline

1. `repairCollapsedSvg()` — fix space-collapsed streaming artifacts
2. Strip `<script>`, `<foreignObject>`, `on*` attributes
3. Strip `javascript:` and `data:text/html` URIs
4. Ensure `xmlns` attribute exists
5. Convert to base64 data URI (rendered as `<img>` outside markdown parser)

## Tool Sandboxing

- CWD: temp directory (`os.tmpdir()`)
- Timeout: 8 seconds (`SIGTERM`)
- Output cap: 8000 characters
- No network access inside run_python / run_js

## Key Management

- `CURSOR_API_KEY`: `.env.local` (gitignored), never sent to client
- `GOOGLE_API_KEY` / `GOOGLE_CSE_ID`: optional, server-side only
- Both validated via `scripts/ensure-env.mjs` at startup

## Files

| File | Role |
|------|------|
| `src/lib/geometry-svg.ts` | `sanitizeSvg()`, `repairCollapsedSvg()` |
| `src/lib/tutor-harness.ts` | Sandbox execution |
| `src/lib/api-rate-limit.ts` | Per-IP sliding window for costly APIs |
| `src/app/robots.ts` | Disallow all crawlers |
| `scripts/ensure-env.mjs` | Key validation + unlock |
| `.env.local.example` | Template (no secrets) |
