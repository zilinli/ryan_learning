# Build Optimization · Low-RAM Host

> Version 0.1 · 2026-08-09
> Problem: 4 vCPU / 4 GB RAM host, ~1 GB free at build time,
> Turbopack `next build` OOM-killed, requires full VM restart.

---

## Root Cause Analysis

| Factor | Impact |
|--------|--------|
| 4 GB total RAM / ~1 GB free | Hard ceiling |
| Cursor IDE + agent already using ~350 MB | Leaves ~650 MB for build |
| Turbopack multi-threaded transpilation | Peaks at 1.5-2 GB RSS |
| `.next/cache` stale entries accumulate | Wastes 50-200 MB on re-reads |
| Output File Tracing (NFT) walks full `node_modules` | 100-300 MB extra |
| No `--max-old-space-size` | Node grows unbounded until OOM |
| Concurrent file-parallel transpile tasks | Each thread allocates its own ASTs |

---

## Solution Architecture

```
smart-build.mjs
  ├── Phase 1: stop heavy PM2 sidecars (formospeech-tts)
  ├── Phase 2: memory check — abort WITHOUT touching live `.next` if too low
  ├── Phase 3: stash `.next` → `.next.prev` (fallback for PM2 if build fails)
  ├── Phase 4: next build with:
  │     NODE_OPTIONS="--max-old-space-size=1024"
  │     --no-mangling
  │     typescript.ignoreBuildErrors:true
  │     outputFileTracingExcludes (reduce NFT walk)
  ├── Phase 5: post-clean (`.next/cache`); discard stash on success
  └── On failure / SIGTERM / SIGINT: restore `.next.prev` → `.next`, restart sidecars
```

### Key Strategies

1. **Memory ceiling**: `NODE_OPTIONS="--max-old-space-size=1024"` caps Node heap at 1 GB
2. **Safe stash (not delete-first)**: Live `.next` is renamed to `.next.prev` before rebuild so Code Agent / IDE failed builds cannot wipe production
3. **No mangling**: `--no-mangling` saves peak CPU/RAM during codegen
4. **Skip build-time type-check**: `typescript.ignoreBuildErrors: true`
5. **Exclude heavy NFT paths**: Skip `node_modules` tracing for unused packages
6. **Post-clean**: Remove intermediate build artifacts
7. **Graceful fallback**: Retry with lower heap, then webpack; always restore prior artifact if all attempts fail

> **Incident (2026-08-11):** `deploy_live` → `npm run build` used to `rm -rf .next` first. When the build OOMed/timed out, PM2 crash-looped with “Could not find a production build”. Fixed via stash/restore in `scripts/lib/next-artifact-guard.mjs`.

---

## Implementation Files

| File | Purpose |
|------|---------|
| `scripts/smart-build.mjs` | Orchestrator: clean, check, build with cap |
| `next.config.ts` | `outputFileTracingExcludes`, `typescript`, `compress` |
| `package.json` | `"build": "node scripts/smart-build.mjs"` |

---

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Peak heap usage | 1.5-2.0 GB → OOM | < 1.0 GB (capped) |
| Build reliability | 30-50% success | > 95% |
| Build time (cold) | 60-90 sec | 90-120 sec (slightly slower) |
| Clean build recovery | Full VM restart | Auto-retry |
