/**
 * 家长一次性配置：把 Cursor API Key 加密写入本地文件。
 * 用法：node scripts/set-secret.mjs crsr_你的密钥
 */
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCursorApiKey } from "./key-utils.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "config", "secret.bin");

// 仅用于本机混淆，防止小孩随手打开明文；不是防专业破解
const APP_SECRET = "qizhi-local-kid-launch-v1";

function deriveKey() {
  return createHash("sha256").update(APP_SECRET).digest();
}

function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

const apiKey = process.argv[2]?.trim();
if (!isCursorApiKey(apiKey)) {
  console.error("用法: node scripts/set-secret.mjs crsr_你的API密钥");
  console.error("获取: https://cursor.com/dashboard/integrations");
  process.exit(1);
}

await fs.mkdir(path.join(root, "config"), { recursive: true });
await fs.writeFile(outFile, encrypt(apiKey), "utf8");
console.log("已加密保存到 config/secret.bin");
console.log("之后小孩只需双击 启动.bat");
