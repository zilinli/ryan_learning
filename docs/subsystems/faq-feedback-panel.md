# FAQ / Feedback Panel + GitHub Issue Sync

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)
> Status: **shipped** · 2026-08-10
> Downstream: [TODO.md](../TODO.md)

---

## 1. Goal

Add a **Help & feedback** control beside GitHub in the sidebar footer. Opens a drawer/modal where users can:

1. **Browse FAQ** — common questions about the tutor
2. **Suggest improvement** — submit feature requests / bug reports

On submit: creates a GitHub issue in `zilinli/ryan_learning` via REST API, then runs an AI-driven feasibility analysis (strict) and appends the result to TODO.md under a "User Feedback" section (or a dedicated plan doc for larger items).

---

## 2. UI Design

### 2.1 Location

Sidebar footer, two equal quiet action chips under Dictionary / Code Agent / Entertainments:

```
[ GitHub ]   [ Help & feedback ]
```

No emoji in labels. Icons are stroke SVGs.

### 2.2 Panel (modal / slide-over)

Opens from right on desktop (soft backdrop blur + shadow), bottom sheet on mobile.
Visual language: Linear / Notion help-center — surface panel, soft gradient header wash, segmented control (not underline tabs), numbered FAQ cards, 2×2 category tiles with SVG icons (no emoji pills).

| Tab | Content |
|-----|---------|
| **FAQ** (default) | Numbered expandable cards; first item open by default; CTA at bottom → Suggest |
| **Suggest** | Category tiles (Bug / Feature / Question / Docs), title, details, primary submit |

### 2.3 States

- **Loading**: spinner on submit button
- **Success**: "Thank you! View issue #N →" with link to GitHub
- **Error**: error message with retry
- **Empty FAQ**: "No FAQs yet" (degenerate case)

---

## 3. Backend: `/api/feedback`

### 3.1 GitHub Issue Creation

```
POST /api/feedback
Body: { category, title, description }
```

Uses GitHub REST API:
```
POST /repos/zilinli/ryan_learning/issues
Authorization: Bearer GITHUB_TOKEN
Body: { title, body, labels: ["user-feedback", category] }
```

**Requires `GITHUB_TOKEN` env var** (classic PAT with `repo` scope).

### 3.2 Feasibility Analysis

After issue creation, runs a strict analysis pipeline:

1. **Classify**: identify type (bug/enhancement/question/docs)
2. **Scope**: estimate effort (quick_win / small / medium / large / epic)
3. **Deps**: check against existing TODO.md / DESIGN.md for conflicts or dependencies
4. **Fit**: does this align with project roadmap?
5. **Recommendation**: accept / defer (with reason) / reject (with reason)

Output written to TODO.md under a `## 📬 User Feedback` section:

```markdown
## 📬 User Feedback (synced from GitHub issues)

- [ ] **GH-{number}** [{category}] {title} — {effort} effort, {recommendation}
  - Description: {truncated description}
  - Analysis: {brief feasibility note}
  - Created: {date}
```

For `epic` items: a dedicated plan file is created in `docs/subsystems/`.

### 3.3 Error handling

- No `GITHUB_TOKEN`: return 503 with clear message
- GitHub API failure: return 502 with error detail
- Analysis failure: still create issue but skip analysis (issue gets `needs-triage` label)

---

## 4. Component Files

| File | Type | Description |
|------|------|-------------|
| `src/components/FeedbackPanel.tsx` | New | FAQ/Suggest panel component |
| `src/components/FeedbackPanel.test.tsx` | New | Component tests |
| `src/app/api/feedback/route.ts` | New | API route |
| `src/lib/feedback-analysis.ts` | New | Feasibility analysis logic |
| `src/lib/feedback-analysis.test.ts` | New | Analysis tests |
| `src/components/HistorySidebar.tsx` | Edit | Add feedback button |

---

## 5. Test Plan

| Test case | Assert |
|-----------|--------|
| Panel opens on click | modal visible |
| FAQ tab shows questions | at least 3 questions rendered |
| Suggest tab shows form | category dropdown + title + description + submit |
| Submit with empty fields | validation error shown |
| Submit success | "Thank you" + GitHub link |
| Submit error | error message + retry button |
| Panel closes on × / Escape | modal hidden |
| feedback-analysis: quick_win bug | correctly classified |
| feedback-analysis: large feature | flagged as epic, needs plan doc |
| feedback-analysis: duplicate | detected via TODO.md scan |
