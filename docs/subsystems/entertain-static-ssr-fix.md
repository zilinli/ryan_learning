# Entertain / Console static SSR fix (2026-08-16)

## Problem

Live `/entertain` returned **Internal Server Error (500)**. PM2 logs showed cascading:

`Could not find the module "…#EntertainPage" in the React Client Manifest`

(same class for `HttpsGate`, layout-router, IconMark, …).

## Root cause

| Route | Render mode | Live status |
|-------|-------------|-------------|
| `/studio`, `/dashboard`, `/me` | **Static prerender** (`x-nextjs-prerender: 1`) | 200 |
| `/entertain` | **Dynamic SSR** (async `searchParams` for `hub=studio` rewrite) | 500 |
| `/console` | **Dynamic SSR** (`export const dynamic = "force-dynamic"`) | 500 |

Same client components work when baked at build time; **request-time RSC** on this production build fails Client Manifest lookup. Not an EntertainPage logic bug.

## Approach

1. Make `/entertain/page.tsx` a sync server page (mirror `/studio`) so Next can prerender HTML.
2. Move legacy `/entertain?hub=studio…` → `/studio…` to **`src/middleware.ts`** using existing `rewriteEntertainStudioSearch`.
3. Drop unnecessary `force-dynamic` on `/console` so it also prerenders.

## Key files

- `src/app/entertain/page.tsx` — static shell
- `src/middleware.ts` — hub=studio redirect (matcher `/entertain`)
- `src/app/console/page.tsx` — remove force-dynamic
- `src/lib/entertain/studio-path.ts` — unchanged helper

## Risks

- Middleware must stay Edge-safe (studio-path is pure URLSearchParams — OK).
- Brief client flash if someone bypasses middleware — low; redirect is server-side.

## Test design

| Layer | What |
|-------|------|
| Unit | Existing `studio-path.test.ts` (rewrite rules) |
| Manual | After `deploy_live`: `/entertain` → 200; `/entertain?hub=studio&game=ted-lab` → 307/308 to `/studio?game=ted-lab`; `/console` → 200 |
| Regression | `/studio` still 200 |
