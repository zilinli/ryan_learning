import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConsoleSessionState } from "./types";
const DIR = path.join(process.cwd(), "data", "console", "sessions");
async function ensureDir() { await fs.mkdir(DIR, { recursive: true }); }
export function newConsoleSessionId() { return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
export async function readConsoleSession(id: string): Promise<ConsoleSessionState | null> { try { await ensureDir(); const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_"); return JSON.parse(await fs.readFile(path.join(DIR, `${safe}.json`), "utf-8")) as ConsoleSessionState; } catch { return null; } }
export async function writeConsoleSession(s: ConsoleSessionState): Promise<void> { await ensureDir(); const id = s.sessionId.replace(/[^a-zA-Z0-9_-]/g, "_"); const fp = path.join(DIR, `${id}.json`); try { await fs.writeFile(fp+".bak", await fs.readFile(fp,"utf-8"), "utf-8"); } catch {} await fs.writeFile(fp, JSON.stringify(s,null,2), "utf-8"); }
export async function deleteConsoleSession(id: string): Promise<void> { try { await fs.unlink(path.join(DIR, `${id.replace(/[^a-zA-Z0-9_-]/g,"_")}.json`)); } catch {} }
