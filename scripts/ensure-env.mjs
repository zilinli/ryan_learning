/**
 * 启动前确保 .env.local 存在：
 * 优先 secret.bin → 已有 .env.local / 环境变量 → 内置默认 Key（免手动输入）。
 */
import { createDecipheriv, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCursorApiKey } from "./key-utils.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const secretFile = path.join(root, "config", "secret.bin");
const envFile = path.join(root, ".env.local");
const APP_SECRET = "qizhi-local-kid-launch-v1";
/** 与 src/lib/default-api-key.ts 保持一致，小孩启动无需输入 */
const DEFAULT_CURSOR_API_KEY =
  "crsr_7d9e4149365f2e279a8716bf279885c58d5bb49d9c74f540b30fc1a20c58dd70";

function deriveKey() {
  return createHash("sha256").update(APP_SECRET).digest();
}

function decrypt(payload) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function readExistingEnvKey() {
  try {
    const raw = await fs.readFile(envFile, "utf8");
    const m = raw.match(/^CURSOR_API_KEY=(.+)$/m);
    const key = m?.[1]?.trim() || "";
    return isCursorApiKey(key) ? key : "";
  } catch {
    return "";
  }
}

let apiKey = process.env.CURSOR_API_KEY?.trim() || "";

try {
  const payload = await fs.readFile(secretFile, "utf8");
  const unlocked = decrypt(payload.trim());
  if (isCursorApiKey(unlocked)) apiKey = unlocked;
} catch {
  // fall through
}

if (!isCursorApiKey(apiKey)) {
  apiKey = await readExistingEnvKey();
}

if (!isCursorApiKey(apiKey)) {
  apiKey = DEFAULT_CURSOR_API_KEY;
}

// Preserve existing non-CURSOR keys (e.g. Merriam-Webster) when rewriting .env.local
let preserved = "";
try {
  const raw = await fs.readFile(envFile, "utf8");
  preserved = raw
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return true;
      return !t.startsWith("CURSOR_API_KEY=");
    })
    .join("\n")
    .replace(/\n+$/, "");
} catch {
  // no existing file
}

const nextBody = preserved
  ? `CURSOR_API_KEY=${apiKey}\n${preserved}\n`
  : `CURSOR_API_KEY=${apiKey}\n`;
await fs.writeFile(envFile, nextBody, "utf8");
console.log("环境已就绪");
