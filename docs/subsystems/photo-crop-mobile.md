# Photo crop — mobile layout fix

> Status: **active** · 2026-08-12  
> Related: [product-audit-2026-08-roadmap.md](product-audit-2026-08-roadmap.md) Slice D · `PhotoCropModal` · `image-process.ts`

## Problem

After camera/album, `PhotoCropModal` lets the student框选 one question. On phones the crop UI was unreliable:

1. **Viewport overflow** — preview used `max-h-[70vh]`. Mobile `vh` includes URL-bar chrome; header + footer + safe areas left less room, so the image overflowed the flex stage and sat under action buttons or off-screen.
2. **Overlay skew** — default inline `<img>` baseline gap made the absolute % overlay taller than the bitmap.
3. **Width** — `max-w-[min(100vw,…)]` ignored parent horizontal padding.
4. **Scroll bleed** — no `body { overflow: hidden }` while open (unlike `CameraCapture`).

`CameraCapture` already used `dvh` + `safe-*` + `min-h-0 flex-1`; crop did not.

## Approach

- Full-screen column: `h-dvh` / `100dvh`, `safe-top` header, `safe-bottom` actions, **flex-1 min-h-0 overflow-hidden** stage.
- Preview image: `block max-h-full max-w-full object-contain` (size to stage, not fixed `70vh`).
- Lock body scroll while open.
- Export pure helpers (`clientToCropNorm`, `rectFromDrag`, `isNearFullFrameCrop`) from `image-process.ts` for unit tests + shared use in the modal.
- Keep “整页” / “只用框选” behavior unchanged.

## Key files

| File | Role |
|------|------|
| `src/components/PhotoCropModal.tsx` | Mobile-safe layout + pointer mapping |
| `src/lib/image-process.ts` | Crop encode + pure geometry helpers |
| `src/lib/__tests__/image-process-crop.test.ts` | Unit tests for helpers + near-full noop |

## Risks

| Risk | Mitigation |
|------|------------|
| Very tall worksheets still tiny on phone | Default ~84% selection + 整页 escape |
| Older browsers without `dvh` | Tailwind/`100dvh` with `inset-0` fallback still fills |
| Canvas EXIF vs display mismatch | Compress path already re-encodes via canvas before crop |

## Test design

### Unit

- `clientToCropNorm` clamps to 0–1; zero-size bounds → `{0,0}`.
- `rectFromDrag` enforces min size and stays in frame.
- `isNearFullFrameCrop` / tiny rect → crop path skips to compress (assert via helper + existing fallback).

### Integration

- Composer still opens crop after camera capture (manual / smoke).

### Manual

- iPhone / Huawei ~390×844: crop box aligns with finger; buttons above home indicator; 只用框选 sends cropped region; 整页 still works.
- Desktop unchanged.
