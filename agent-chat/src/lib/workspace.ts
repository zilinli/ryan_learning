import fs from "node:fs";
import path from "node:path";
import type { WorkspaceNode, FileContent } from "./types";

const ALLOWED_ROOT = "/root/codes/ryan_learning";
const IGNORE_DIRS = new Set(["node_modules", ".next", ".git", "__pycache__", ".cursor"]);
const IGNORE_FILES = new Set([".DS_Store"]);
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_CHILDREN = 200;

function isSafe(absolutePath: string): boolean {
  const resolved = path.resolve(absolutePath);
  return resolved.startsWith(ALLOWED_ROOT);
}

function mimeType(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".js": "text/javascript",
    ".jsx": "text/javascript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".html": "text/html",
    ".css": "text/css",
    ".py": "text/x-python",
    ".sh": "text/x-shellscript",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".txt": "text/plain",
    ".env": "text/plain",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

function langFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".json": "json",
    ".md": "markdown",
    ".html": "html",
    ".css": "css",
    ".py": "python",
    ".sh": "bash",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".txt": "text",
  };
  return map[ext.toLowerCase()] || "text";
}

export function scanDirectory(dirPath: string): WorkspaceNode {
  const resolved = path.resolve(dirPath);
  if (!isSafe(resolved)) {
    throw new Error("Access denied");
  }

  const stat = fs.statSync(resolved);
  const node: WorkspaceNode = {
    path: resolved,
    name: path.basename(resolved),
    type: "directory",
  };

  if (!stat.isDirectory()) {
    node.type = "file";
    node.size = stat.size;
    return node;
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const children: WorkspaceNode[] = [];

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (IGNORE_FILES.has(entry.name)) continue;
      if (entry.name.startsWith(".env")) continue;
      if (entry.name === "secret.bin") continue;

      if (children.length >= MAX_CHILDREN) break;

      const childPath = path.join(resolved, entry.name);
      const childStat = fs.statSync(childPath);
      children.push({
        path: childPath,
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        size: childStat.size,
      });
    }

    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    node.children = children;
  } catch {
    // unreadable
  }

  return node;
}

export function readFileContents(filePath: string): FileContent {
  const resolved = path.resolve(filePath);
  if (!isSafe(resolved)) {
    throw new Error("Access denied");
  }

  if (resolved.includes("node_modules") || resolved.includes(".git")) {
    throw new Error("Cannot read files in node_modules or .git");
  }

  const stat = fs.statSync(resolved);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error("FILE_TOO_LARGE");
  }

  const ext = path.extname(resolved);
  const mt = mimeType(ext);

  if (mt.startsWith("text/") || mt === "application/json") {
    const content = fs.readFileSync(resolved, "utf-8");
    return {
      path: resolved,
      size: stat.size,
      mimeType: mt,
      content,
      lines: content.split("\n").length,
      language: langFromExt(ext),
    };
  }

  const content = fs.readFileSync(resolved).toString("base64");
  return {
    path: resolved,
    size: stat.size,
    mimeType: mt,
    content,
    lines: 0,
    language: "binary",
  };
}
