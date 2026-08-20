#!/usr/bin/env node
/**
 * Cursor Agent 驱动脚本 — 供 OpenClaw skill 调用
 * 用法: node cursor-run.mjs --cwd <工作目录> --prompt-file <提示词文件> [--model <模型>]
 * 读取环境变量 CURSOR_API_KEY 作为认证密钥。
 */
import { Agent } from "@cursor/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

const cwd = flag("--cwd") ?? process.cwd();
const promptFile = flag("--prompt-file");
const model = flag("--model") ?? "composer-2.5";

if (!promptFile) {
  console.error("缺少 --prompt-file 参数");
  process.exit(1);
}

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
  console.error("缺少 CURSOR_API_KEY 环境变量");
  process.exit(1);
}

const prompt = await readFile(promptFile, "utf8");
const resolvedCwd = path.resolve(cwd);

console.error(`[cursor] 开始任务: cwd=${resolvedCwd} model=${model}`);
console.error(`[cursor] 任务内容前 200 字: ${prompt.slice(0, 200).replace(/\n/g, " ")}`);

try {
  const agent = await Agent.create({
    apiKey,
    model: { id: model },
    local: { cwd: resolvedCwd },
  });

  const run = await agent.send(prompt);
  const result = await run.wait();

  if (result.status === "error") {
    console.error(`[cursor] 任务出错: ${JSON.stringify(result.error ?? {})}`);
    process.exit(1);
  }

  console.log(`\n[CURSOR_RESULT_STATUS] ${result.status}`);
  console.log(`[CURSOR_RESULT]\n${result.result ?? "(无文本结果)"}`);
  await agent.dispose?.();
} catch (err) {
  console.error(`[cursor] 异常: ${err?.message ?? err}`);
  process.exit(1);
}
