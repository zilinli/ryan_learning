# Document upload & parse (MD / Office / HTML)

> **Subsystem** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipped** · 2026-08-10 · **iOS picker follow-up (defer mount + overlay)**  
> Related: [code-agent-v3-enhancements.md](../code-agent-v3-enhancements.md) · [security-sanitization.md](security-sanitization.md) · [ai-faq.md](ai-faq.md)

---

## Problem

Upload pickers (Tutor Composer, Code Agent console, Ask AI) mostly accept photos / PDF / plain text. Students and builders also send **Markdown, Word, PowerPoint, Excel, and HTML**. Those files were rejected client-side, or uploaded as garbled `readAsText` binaries, so the model never saw real content.

**Follow-up (iPhone Code Agent):** Desktop allowlist already includes `.md`, but iOS Safari **grays out uncommon extensions** when `<input accept>` lists MIME/ext filters (known WebKit quirk). Code Agent also used `display:none` + programmatic `click()`, which is less reliable than Tutor’s `label` + `sr-only` pattern.

**Follow-up 2 (still broken on device):** Omitting `accept` after mount is not enough. React state started as the desktop `accept` string, then `useEffect` cleared it on iPhone — WebKit can keep the **first** filter, so `.md` stays grayed/invisible. Off-screen `sr-only` inputs can also open the sheet but drop `change` on some iOS versions.

## Approach

1. **Allowlist** — Extend `isAllowedAttachment` / `normalizeMime` for `.md` (already), `.html`/`.htm`, `.docx`/`.pptx`/`.xlsx`, plus console code exts. Accept any `text/*` MIME (iOS often reports markdown as plain text / x-markdown).
2. **Client payload** — Text-like files keep `textContent` (MD/HTML/code). Office Open XML files ship as **base64** (same path as PDF), never `readAsText`.
3. **Server extract** — `buildFileSummaries`:
   - PDF: existing poppler / pdf-parse
   - Office: `officeparser@3.2.2` `parseOfficeAsync` via temp file
   - HTML: strip script/style/tags → plain text
   - Cap summaries at 12k chars (unchanged)
4. **UI accept** — Shared `FILE_INPUT_ACCEPT` (+ console-extra for code) on desktop. On **iPhone/iPad**, omit `accept` so Files are selectable; still enforce allowlist in `filesToAttachments`.
5. **Defer mount** — Do **not** render `<input type="file">` until after `resolveFilePickerAccept` runs. Apple touch mounts once with **no** `accept`; desktop mounts once with the filter. Never flip accept after the element exists.
6. **iOS input chrome** — Put the file input **inside** the attach `<label>` with `opacity-0` covering the hit target (not `display:none` / not off-screen `sr-only`), so the system gesture and `change` stay reliable.

## Key files

| File | Change |
|------|--------|
| `src/lib/attachments.ts` | Allowlist, MIME normalize, `FILE_INPUT_ACCEPT`, `isAppleTouchDevice`, `resolveFilePickerAccept` |
| `src/lib/file-payload.ts` | Office → base64; HTML as text; clearer errors |
| `src/lib/extract-files.ts` | Office + HTML extractors |
| `src/components/Composer.tsx` | Defer mount + overlay input; iOS-safe accept |
| `src/components/ConsoleComposer.tsx` | Defer mount + overlay input; iOS-safe accept |
| `src/components/FaqAskPanel.tsx` | Defer mount + overlay input; iOS-safe accept |
| `agent-chat/src/lib/attachments.ts` | Parity allowlist (legacy tests) |
| `package.json` | pin `officeparser@3.2.2` |

## Risks

- **Legacy `.doc` / `.ppt` / `.xls`** — not OOXML; reject with clear message (no LibreOffice on host).
- **Huge decks/spreadsheets** — truncated to 12k; OK for tutoring context.
- **HTML XSS** — only text summary enters prompts; scripts stripped; never executed.
- **Temp files** — officeparser writes decompress dir; always cleaned in `finally` (same pattern as PDF).
- **iOS omit-accept** — user can pick disallowed types; client shows clear reject error (same as desktop pasting). Photo Library still available via the system sheet.
- **Defer mount** — attach control inert for one paint until effect runs (acceptable).

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
| DOC-11 | unit | Document: Apple → `undefined` accept; desktop → keep filter (no flip-after-mount contract) |
| DOC-12 | manual | iPhone: open picker → Browse → `.md` selectable (not grayed) → pill + Send |
