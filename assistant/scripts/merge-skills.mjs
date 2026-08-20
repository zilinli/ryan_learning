#!/usr/bin/env node
/**
 * Merge SKILL.md + {platform}.md into ~/.openclaw/workspace/skills/
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSISTANT_ROOT = path.resolve(__dirname, "..");
const SKILLS_SRC = path.join(ASSISTANT_ROOT, "openclaw-config", "workspace", "skills");

function platformKey() {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  return process.platform;
}

export function mergeSkills(outDir, platform = platformKey()) {
  mkdirSync(outDir, { recursive: true });
  const platFile = platform === "darwin" ? "darwin.md" : platform === "win32" ? "win32.md" : `${platform}.md`;

  for (const name of readdirSync(SKILLS_SRC, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const skillDir = path.join(SKILLS_SRC, name.name);
    const destDir = path.join(outDir, name.name);
    mkdirSync(destDir, { recursive: true });

    const basePath = path.join(skillDir, "SKILL.md");
    const platPath = path.join(skillDir, platFile);
    if (!existsSync(basePath)) continue;

    let content = readFileSync(basePath, "utf8");
    if (existsSync(platPath)) {
      content += "\n\n---\n\n" + readFileSync(platPath, "utf8");
    }
    writeFileSync(path.join(destDir, "SKILL.md"), content, "utf8");

    for (const extra of readdirSync(skillDir)) {
      if (extra === "SKILL.md" || extra.endsWith(".md")) continue;
      const src = path.join(skillDir, extra);
      writeFileSync(path.join(destDir, extra), readFileSync(src));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out =
    process.argv[2] || path.join(os.homedir(), ".openclaw", "workspace", "skills");
  mergeSkills(out);
  console.log(`Merged skills → ${out}`);
}
