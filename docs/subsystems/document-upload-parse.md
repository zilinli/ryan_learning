# Document upload & parse (MD / Office / HTML)

> **Subsystem** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipping** · 2026-08-10 · **iOS3: */* accept + opacity-0.01 + 44px + paste**  
> Related: [code-agent-v3-enhancements.md](../code-agent-v3-enhancements.md) · [security-sanitization.md](security-sanitization.md) · [ai-faq.md](ai-faq.md)

---

## Problem

Upload pickers (Tutor Composer, Code Agent console, Ask AI) mostly accept photos / PDF / plain text. Students and builders also send **Markdown, Word, PowerPoint, Excel, and HTML**. Those files were rejected client-side, or uploaded as garbled `readAsText` binaries, so the model never saw real content.

**Follow-up (iPhone Code Agent):** Desktop allowlist already includes `.md`, but iOS Safari **grays out uncommon extensions** when `<input accept>` lists MIME/ext filters (known WebKit quirk). Code Agent also used `display:none` + programmatic `click()`, which is less reliable than Tutor’s `label` + `sr-only` pattern.

**Follow-up 2:** Omitting `accept` after mount is not enough. React state started as the desktop `accept` string, then `useEffect` cleared it on iPhone — WebKit can keep the **first** filter, so `.md` stays grayed/invisible. Off-screen `sr-only` inputs can also open the sheet but drop `change` on some iOS versions.

**Follow-up 3 (still broken after defer-mount):** Device still reports attach fails. Remaining risks: (1) bare omit-accept vs explicit `accept="*/*"`; (2) `opacity-0` inputs ignored by some WebKit builds — use `opacity: 0.01`; (3) Code Agent attach was only 32×32px (need ≥44×44); (4) no paste-files fallback when Browse hides `.md`.

## Approach

1. **Allowlist** — Extend `isAllowedAttachment` / `normalizeMime` for `.md` (already), `.html`/`.htm`, `.docx`/`.pptx`/`.xlsx`, plus console code exts. Accept any `text/*` MIME (iOS often reports markdown as plain text / x-markdown).
2. **Client payload** — Text-like files keep `textContent` (MD/HTML/code). Office Open XML files ship as **base64** (same path as PDF), never `readAsText`.
3. **Server extract** — `buildFileSummaries`:
   - PDF: existing poppler / pdf-parse
   - Office: `officeparser@3.2.2` `parseOfficeAsync` via temp file
   - HTML: strip script/style/tags → plain text
   - Cap summaries at 12k chars (unchanged)
4. **UI accept** — Shared `FILE_INPUT_ACCEPT` (+ console-extra for code) on desktop. On **iPhone/iPad**, mount once with `accept="*/*"` (never desktop filter first); still enforce allowlist in `filesToAttachments`.
5. **Defer mount** — Do **not** render `<input type="file">` until after `resolveFilePickerAccept` runs. Never flip accept after the element exists.
6. **iOS input chrome** — Shared `FileAttachControl`: input **inside** the attach `<label>`, `opacity: 0.01` overlay (not `0` / not `display:none` / not off-screen), **≥44×44** hit target.
7. **Paste fallback** — Composer textareas accept `clipboardData.files` on paste so Files → Copy → Paste still attaches when Browse hides `.md`.

## Key files

| File | Change |
|------|--------|
| `src/lib/attachments.ts` | Allowlist, MIME normalize, `FILE_INPUT_ACCEPT`, `isAppleTouchDevice`, `resolveFilePickerAccept` |
| `src/lib/file-payload.ts` | Office → base64; HTML as text; clearer errors |
| `src/lib/extract-files.ts` | Office + HTML extractors |
| `src/components/FileAttachControl.tsx` | Shared iOS-safe file input (defer, */*, opacity 0.01, 44px) |
| `src/components/Composer.tsx` | Use FileAttachControl + paste-files |
| `src/components/ConsoleComposer.tsx` | Use FileAttachControl + paste-files; 44px hit target |
| `src/components/FaqAskPanel.tsx` | Use FileAttachControl |
| `agent-chat/src/lib/attachments.ts` | Parity allowlist (legacy tests) |
| `package.json` | pin `officeparser@3.2.2` |

## Risks

- **Legacy `.doc` / `.ppt` / `.xls`** — not OOXML; reject with clear message (no LibreOffice on host).
- **Huge decks/spreadsheets** — truncated to 12k; OK for tutoring context.
- **HTML XSS** — only text summary enters prompts; scripts stripped; never executed.
- **Temp files** — officeparser writes decompress dir; always cleaned in `finally` (same pattern as PDF).
- **iOS `*/*` accept** — user can pick disallowed types; client shows clear reject error. Photo Library still available via the system sheet.
- **Defer mount** — attach control inert for one paint until effect runs (acceptable).
- **opacity 0.01** — still nearly invisible; avoid `opacity-0` which some WebKit builds treat as non-interactive.

## Test design

| ID | Layer | Case |
|----|-------|------|
| DOC-1 | unit | `isAllowedAttachment` true for md/html/docx/pptx/xlsx |
| DOC-2 | unit | `isAllowedAttachment` false for `.exe` / raw `.zip` / `.doc` |
| DOC-3 | unit | `normalizeMime` maps office + html extensions |
| DOC-4 | unit | `buildFileSummaries` uses `textContent` for `.html` after strip (fixture string) |
| DOC-5 | unit | `buildFileSummaries` extracts text from minimal fixture `.docx` |
| DOC-6 | unit | Office without binary → honest extract-fail message |
| DOC-7 | manual | Tutor + Console + Ask AI: upload sample md/docx/pptx/xlsx/html → model cites content |
| DOC-8 | unit | `isAllowedAttachment` true for `text/*` / `text/x-markdown` |
| DOC-9 | unit | `isAppleTouchDevice` / `resolveFilePickerAccept` omit accept on iPhone UA |
| DOC-10 | manual | **iPhone Safari Code Agent**: Files → pick `.md` → pill appears → Send |
| DOC-11 | unit | Apple → `accept="*/*"`; desktop → keep filter (no flip-after-mount) |
| DOC-12 | manual | iPhone: open picker → Browse → `.md` selectable → pill + Send |
| DOC-13 | unit | `resolveFilePickerAccept` returns `*/*` on Apple touch |
| DOC-14 | manual | iPhone: Files → Copy file → paste into composer → pill appears |
