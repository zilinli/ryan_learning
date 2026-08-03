/**
 * Render all Mermaid diagrams from docs/ to SVG using Playwright Chromium.
 * Usage: node scripts/render-mermaid.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { chromium } from "playwright";

const DOCS_DIR = join(process.cwd(), "docs");
const FIGURES_DIR = join(DOCS_DIR, "figures");

function extractMermaidBlocks(filePath) {
  const lines = readFileSync(filePath, "utf-8").split("\n");
  const blocks = [];
  let inBlock = false, codeLines = [], blockStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && line.trim() === "```mermaid") {
      inBlock = true; blockStart = i; codeLines = [];
    } else if (inBlock && line.trim() === "```") {
      inBlock = false;
      blocks.push({ startLine: blockStart, endLine: i, code: codeLines.join("\n") });
    } else if (inBlock) {
      codeLines.push(line);
    }
  }
  return blocks;
}

function filenameFromBlock(fileBase, index, code) {
  const type = code.split("\n")[0]?.trim().split(/\s+/)[0] || "diagram";
  return `${fileBase}-${index}-${type}.svg`;
}

async function main() {
  mkdirSync(FIGURES_DIR, { recursive: true });

  const mdFiles = readdirSync(DOCS_DIR, { recursive: true })
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(DOCS_DIR, f));

  const diagrams = [];
  for (const filePath of mdFiles) {
    const blocks = extractMermaidBlocks(filePath);
    if (!blocks.length) continue;
    const fileBase = basename(filePath, extname(filePath));
    const relDir = filePath.replace(DOCS_DIR + "/", "").replace(basename(filePath), "");
    for (let i = 0; i < blocks.length; i++) {
      const { code, startLine } = blocks[i];
      const filename = filenameFromBlock(fileBase, i, code);
      diagrams.push({
        mdPath: filePath, mdRel: relDir + basename(filePath),
        fileBase, index: i, code, line: startLine + 1, filename,
        svgPath: join(FIGURES_DIR, filename), svgRel: `figures/${filename}`,
      });
    }
  }

  if (!diagrams.length) { console.log("No mermaid diagrams found."); return; }
  console.log(`Found ${diagrams.length} diagrams across ${new Set(diagrams.map(d => d.mdRel)).size} files.`);

  // Build HTML page
  const diagramDivs = diagrams.map(d =>
    `<div class="diagram" id="d${d.fileBase}-${d.index}" data-file="${d.mdRel}:${d.line}">` +
    `<pre class="mermaid">${d.code.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>` +
    `<div class="status">rendering…</div></div>`
  ).join("\n");

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Mermaid Render</title>
<style>body{margin:0;padding:20px;font-family:sans-serif;background:#fff}.diagram{margin-bottom:40px;padding:16px;border:1px solid #e0e0e0;border-radius:8px}.diagram.error{border-color:#e53e3e;background:#fff5f5}.diagram.error svg{display:none}.status{font-size:12px;color:#999;margin-top:8px}.diagram.error .status{color:#e53e3e}.error-msg{font-size:12px;color:#e53e3e;margin-top:4px;white-space:pre-wrap}</style>
</head><body>${diagramDivs}
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
const divs = document.querySelectorAll(".diagram");
let count = 0;
for (const div of divs) {
  const pre = div.querySelector("pre.mermaid");
  const code = pre.textContent;
  try {
    const { svg } = await mermaid.render(div.id + "-svg", code);
    pre.outerHTML = svg;
    div.querySelector(".status").textContent = "OK";
    count++;
  } catch (err) {
    div.classList.add("error");
    div.querySelector(".status").textContent = "ERR: " + err.message;
    const e = document.createElement("div");
    e.className = "error-msg"; e.textContent = String(err);
    div.appendChild(e);
  }
}
document.body.setAttribute("data-done", String(count));
</script></body></html>`;

  const htmlPath = join(FIGURES_DIR, "_render.html");
  writeFileSync(htmlPath, html, "utf-8");

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.getAttribute("data-done") !== null, { timeout: 60000 });
  await page.waitForTimeout(3000);

  // Extract SVGs
  let ok = 0, err = 0;
  const manifest = [];
  for (const d of diagrams) {
    try {
      const svgContent = await page.evaluate((id) => {
        const svg = document.getElementById(id)?.querySelector("svg");
        return svg ? svg.outerHTML : null;
      }, `d${d.fileBase}-${d.index}`);

      if (svgContent) {
        writeFileSync(d.svgPath, svgContent, "utf-8");
        manifest.push({ mdFile: d.mdRel, svg: d.svgRel, line: d.line, type: d.code.split("\n")[0]?.trim().split(/\s+/)[0] });
        ok++;
        console.log(`OK  ${d.svgRel}`);
      } else {
        const errMsg = await page.evaluate((id) => {
          return document.getElementById(id)?.querySelector(".error-msg")?.textContent || "no SVG";
        }, `d${d.fileBase}-${d.index}`);
        err++;
        console.error(`ERR ${d.mdRel}:${d.line} — ${errMsg}`);
      }
    } catch (e) {
      err++;
      console.error(`ERR ${d.mdRel}:${d.line} — ${e.message}`);
    }
  }

  await browser.close();
  writeFileSync(join(FIGURES_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`\n${ok} OK, ${err} ERR → docs/figures/`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
