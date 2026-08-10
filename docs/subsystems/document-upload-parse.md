# Document upload & parse (MD / Office / HTML)

> **Subsystem** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **shipped** · 2026-08-10  
> Related: [code-agent-v3-enhancements.md](../code-agent-v3-enhancements.md) · [security-sanitization.md](security-sanitization.md) · [ai-faq.md](ai-faq.md)

---

## Problem

Upload pickers (Tutor Composer, Code Agent console, Ask AI) mostly accept photos / PDF / plain text. Students and builders also send **Markdown, Word, PowerPoint, Excel, and HTML**. Those files were rejected client-side, or uploaded as garbled `readAsText` binaries, so the model never saw real content.

## Approach

1. **Allowlist** — Extend `isAllowedAttachment` / `normalizeMime` for `.md` (already), `.html`/`.htm`, `.docx`/`.pptx`/`.xlsx`, plus console code exts already in the picker (`.ts`/`.tsx`/`.js`/`.jsx`/`.py`/`json`/`log`).
2. **Client payload** — Text-like files keep `textContent` (MD/HTML/code). Office Open XML files ship as **base64** (same path as PDF), never `readAsText`.
3. **Server extract** — `buildFileSummaries`:
   - PDF: existing poppler / pdf-parse
   - Office: `officeparser@3.2.2` `parseOfficeAsync` via temp file
   - HTML: strip script/style/tags → plain text
   - Cap summaries at 12k chars (unchanged)
4. **UI accept** — Shared `FILE_INPUT_ACCEPT` (+ console-extra for code) on Composer / ConsoleComposer / FaqAskPanel.

## Key files

| File | Change |
|------|--------|
| `src/lib/attachments.ts` | Allowlist, MIME normalize, `FILE_INPUT_ACCEPT` |
| `src/lib/file-payload.ts` | Office → base64; HTML as text; clearer errors |
| `src/lib/extract-files.ts` | Office + HTML extractors |
| `src/components/Composer.tsx` | accept= shared constant |
| `src/components/ConsoleComposer.tsx` | accept= shared + code |
| `src/components/FaqAskPanel.tsx` | accept= shared |
| `agent-chat/src/lib/attachments.ts` | Parity allowlist (legacy tests) |
| `package.json` | pin `officeparser@3.2.2` |

## Risks

- **Legacy `.doc` / `.ppt` / `.xls`** — not OOXML; reject with clear message (no LibreOffice on host).
- **Huge decks/spreadsheets** — truncated to 12k; OK for tutoring context.
- **HTML XSS** — only text summary enters prompts; scripts stripped; never executed.
- **Temp files** — officeparser writes decompress dir; always cleaned in `finally` (same pattern as PDF).

## Test design

| ID | Layer | Case |
|----|-------|------|
| DOC-1 | unit | `isAllowedAttachment` true for md/html/docx/pptx/xlsx |
| DOC-2 | unit | `isAllowedAttachment` false for `.exe` / raw `.zip` / `.doc` |
| DOC-3 | unit | `normalizeMime` maps office + html extensions |
| DOC-4 | unit | `buildFileSummaries` uses `textContent` for `.html` after strip (fixture string) |
| DOC-5 | unit | `buildFileSummaries` extracts text from minimal fixture `.docx` (generated zip OOXML or mocked) |
| DOC-6 | unit | Office without binary → honest "No extractable text" / extract-fail message |
| DOC-7 | manual | Tutor + Console + Ask AI: upload sample md/docx/pptx/xlsx/html → model cites content |
