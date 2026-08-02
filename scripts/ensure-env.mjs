/**
 * 启动前确保 .env.local 存在：优先 secret.bin，其次已有 .env.local / 环境变量。
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
  console.error(
    "未找到 CURSOR_API_KEY。请配置 .env.local 或运行: node scripts/set-secret.mjs <key>",
  );
  process.exit(1);
}

await fs.writeFile(envFile, `CURSOR_API_KEY=${apiKey}\n`, "utf8");
console.log("环境已就绪");
