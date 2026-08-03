/**
 * Replace mermaid code blocks in docs/*.md with image references using manifest.json.
 * Usage: node scripts/replace-mermaid-refs.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = join(process.cwd(), "docs");
const manifest = JSON.parse(readFileSync(join(DOCS_DIR, "figures", "manifest.json"), "utf-8"));

// Group by mdFile
const byFile = {};
for (const entry of manifest) {
  if (!byFile[entry.mdFile]) byFile[entry.mdFile] = [];
  byFile[entry.mdFile].push(entry);
}

for (const [mdRel, entries] of Object.entries(byFile)) {
  const mdPath = join(DOCS_DIR, mdRel);
  let content = readFileSync(mdPath, "utf-8");

  // Sort by line descending so replacements don't shift positions
  entries.sort((a, b) => b.line - a.line);

  for (const entry of entries) {
    // Find the mermaid block starting at entry.line and ending at the next ```
    const lines = content.split("\n");
    const startIdx = entry.line - 1; // 0-indexed from 1-indexed line
    if (!lines[startIdx]?.trim().startsWith("```mermaid")) {
      console.error(`WARN: ${mdRel}:${entry.line} — expected \`\`\`mermaid, got: ${lines[startIdx]?.trim()?.slice(0,20)}`);
      continue;
    }
    // Find the closing ```
    let endIdx = startIdx + 1;
    while (endIdx < lines.length && !lines[endIdx].trim().startsWith("```")) endIdx++;

    // Compute relative path from the md file to the figure
    const mdDir = mdRel.includes("/") ? mdRel.split("/").slice(0, -1).join("/") + "/" : "";
    const relSvgPath = mdDir ? `../figures/${entry.svg.split("/").pop()}` : entry.svg;

    // Replace the block with an image
    const replacement = `![${entry.type || "diagram"}](${relSvgPath})`;
    lines.splice(startIdx, endIdx - startIdx + 1, replacement);
    content = lines.join("\n");
  }

  writeFileSync(mdPath, content, "utf-8");
  console.log(`OK  ${mdRel}  (${entries.length} diagrams replaced)`);
}
