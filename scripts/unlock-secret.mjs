/**
 * 启动时解密本地密钥，写出 .env.local（供 Next.js 读取）
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

try {
  const payload = await fs.readFile(secretFile, "utf8");
  const apiKey = decrypt(payload.trim());
  if (!isCursorApiKey(apiKey)) {
    throw new Error("解密结果不是有效的 Cursor API Key");
  }
  await fs.writeFile(envFile, `CURSOR_API_KEY=${apiKey}\n`, "utf8");
  console.log("密钥已解锁");
} catch (err) {
  console.error("无法解锁密钥：", err instanceof Error ? err.message : err);
  console.error("请家长先运行: node scripts/set-secret.mjs crsr_你的密钥");
  process.exit(1);
}
