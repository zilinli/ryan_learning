/**
 * AUD.6b / RPT4.2 — Printable Learning Portfolio (HTML → browser print).
 * No PDF library; parent PIN page only. Narrative + subjects + focus samples.
 */

import type { FamilyReport } from "./family-report";

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function learningPortfolioFilename(
  accountLabel: string,
  now = Date.now(),
): string {
  const safe =
    String(accountLabel || "student")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 32) || "student";
  const day = new Date(now).toISOString().slice(0, 10);
  return `spark-portfolio-${safe}-${day}.html`;
}

/**
 * Build a self-contained printable HTML document from a FamilyReport.
 */
export function buildLearningPortfolioHtml(
  report: FamilyReport,
  opts: { schoolYear?: string; now?: number } = {},
): string {
  const now = opts.now ?? Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const year =
    opts.schoolYear ||
    (() => {
      const d = new Date(now);
      const y = d.getFullYear();
      const m = d.getMonth(); // 0-based; Aug+ → current–next
      return m >= 7 ? `${y}–${y + 1}` : `${y - 1}–${y}`;
    })();

  const subjects = report.radar.length
    ? report.radar
        .map(
          (r) =>
            `<li><strong>${esc(r.label)}</strong> — mastery ~${r.value}%</li>`,
        )
        .join("\n")
    : "<li>No subject radar yet — a few tutor chats will fill this in.</li>";

  const focus = report.focus.length
    ? report.focus
        .map((s) => `<li>${esc(s.label)} (${s.mastery}%)</li>`)
        .join("\n")
    : "<li>No focus skills flagged.</li>";

  const patterns = report.patterns.length
    ? report.patterns
        .slice(0, 6)
        .map(
          (p) =>
            `<li><strong>${esc(p.label)}</strong> (×${p.count}) — ${esc(p.parentTip)}</li>`,
        )
        .join("\n")
    : "<li>No tagged mistake patterns yet.</li>";

  const practiced = report.practicedBars.length
    ? report.practicedBars
        .slice(0, 8)
        .map(
          (p) =>
            `<li>${esc(p.label)} — ${p.mastery}% <em>(${esc(p.hint)})</em></li>`,
        )
        .join("\n")
    : "<li>No practice logged in the last 7 days.</li>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Learning Portfolio — ${esc(report.accountLabel)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 2rem auto; padding: 0 1.25rem; color: #1a1a1a; line-height: 1.45; }
  h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.1rem; margin-top: 1.6rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
  .meta { color: #555; font-size: 0.9rem; }
  .narrative { background: #f4f7f6; padding: 0.9rem 1rem; border-radius: 6px; }
  ul { padding-left: 1.2rem; }
  .kpis { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1rem 0; }
  .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 0.5rem 0.75rem; min-width: 5.5rem; }
  .kpi b { display: block; font-size: 1.25rem; }
  .kpi span { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
  footer { margin-top: 2rem; font-size: 0.75rem; color: #888; }
  @media print { body { margin: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <p class="meta">The Answer Book · AI Tutor — Learning Portfolio</p>
  <h1>${esc(report.accountLabel)}</h1>
  <p class="meta">School year ${esc(year)} · Generated ${esc(day)}</p>

  <div class="kpis">
    <div class="kpi"><b>${report.kpis.skillsTracked}</b><span>Skills</span></div>
    <div class="kpi"><b>${report.kpis.practicedThisWeek}</b><span>Practiced 7d</span></div>
    <div class="kpi"><b>${report.kpis.gains}</b><span>Gains</span></div>
    <div class="kpi"><b>${report.kpis.watch}</b><span>Watch</span></div>
    <div class="kpi"><b>${report.kpis.reviewDue}</b><span>Review due</span></div>
    <div class="kpi"><b>${report.kpis.effortAttempts}</b><span>Effort</span></div>
  </div>

  <h2>Parent narrative</h2>
  <p class="narrative">${esc(report.narrative)}</p>

  <h2>Subjects</h2>
  <ul>
${subjects}
  </ul>

  <h2>Practiced this week</h2>
  <ul>
${practiced}
  </ul>

  <h2>Next focus</h2>
  <ul>
${focus}
  </ul>

  <h2>Mistake patterns &amp; home tips</h2>
  <ul>
${patterns}
  </ul>

  <h2>Week text</h2>
  <p>${esc(report.weekly.text)}</p>

  <footer>Private family record · Not for public sharing · Print or Save as PDF from the browser.</footer>
  <p class="no-print"><button type="button" onclick="window.print()">Print / Save as PDF</button></p>
</body>
</html>`;
}

/** Open a print-ready portfolio window (browser only). */
export function openLearningPortfolioPrint(html: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give styles a tick before print
  window.setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* user can print manually */
    }
  }, 250);
}
