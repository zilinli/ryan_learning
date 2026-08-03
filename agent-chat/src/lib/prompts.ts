import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_WORKSPACE = "/root/codes/ryan_learning";

export interface PromptContext {
  workspacePath: string;
  osInfo: string;
  userMessage: string;
}

function getFileTreeSummary(workspacePath: string): string {
  const maxDepth = 2;
  const ignore = new Set([
    "node_modules",
    ".next",
    ".git",
    "__pycache__",
    ".DS_Store",
  ]);

  function walk(dir: string, depth: number, prefix: string): string {
    if (depth > maxDepth) return "";
    let result = "";
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const filtered = entries
        .filter((e) => !ignore.has(e.name) && !e.name.startsWith(".env"))
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 30);

      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const isLast = i === filtered.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          result += `${prefix}${connector}📁 ${entry.name}/\n`;
          result += walk(fullPath, depth + 1, prefix + (isLast ? "    " : "│   "));
        } else {
          const size = fs.statSync(fullPath).size;
          result += `${prefix}${connector}📄 ${entry.name} (${size}B)\n`;
        }
      }
    } catch {
      // skip unreadable dirs
    }
    return result;
  }

  return walk(workspacePath, 0, "");
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const treeSummary = getFileTreeSummary(ctx.workspacePath);

  return `You are Cursor, an AI coding assistant running on a Linux server. You help developers write, edit, and debug code through a web-based chat interface.

## Environment
- OS: ${ctx.osInfo}
- Workspace: ${ctx.workspacePath}
- Shell: bash
- Node.js: available (node, npm, npx)
- Python: available (python3, pip3)

## Workspace Structure
\`\`\`
${treeSummary}
\`\`\`

## Capabilities
1. Read, write, and edit files in the workspace
2. Execute shell commands (mkdir, ls, git, npm, python3, etc.)
3. Search code with grep/ripgrep
4. Search the web for documentation

## Rules
- NEVER execute destructive commands (rm -rf, format disks, etc.) without explicit user confirmation
- When creating files, ensure parent directories exist first
- Follow existing project conventions (TypeScript, ESLint, etc.)
- Explain what you're doing concisely — show the key code, not every line
- Prefer creating new files over editing large existing ones when possible
- Respond in the same language as the user (Chinese → Chinese, English → English)

## Current Request
${ctx.userMessage}`;
}

export function getOSInfo(): string {
  return `${os.type()} ${os.release()} (${os.arch()}), Node ${process.version}`;
}

export { DEFAULT_WORKSPACE };
