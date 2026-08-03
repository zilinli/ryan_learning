import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newConsoleSessionId, readConsoleSession, writeConsoleSession, deleteConsoleSession } from "./console-session-store";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConsoleSessionState } from "./types";
const DIR = path.join(process.cwd(), "data", "console", "sessions");
let sid: string;
beforeAll(async () => { sid = newConsoleSessionId(); });
afterAll(async () => { await deleteConsoleSession(sid); try { await fs.rm(DIR, { recursive: true, force: true }); } catch {} });
describe("console-session-store", () => {
  it("newConsoleSessionId returns a unique string", () => { expect(sid).toMatch(/^cs_\d+_[a-z0-9]+$/); });
  it("readConsoleSession returns null for unknown", async () => { expect(await readConsoleSession("nonexistent_999")).toBeNull(); });
  it("round-trip write/read", async () => {
    const state: ConsoleSessionState = { sessionId: sid, messages: [], fileChangeCount: 0, hasUncommittedChanges: false };
    await writeConsoleSession(state);
    const loaded = await readConsoleSession(sid);
    expect(loaded).not.toBeNull(); expect(loaded!.sessionId).toBe(sid); expect(loaded!.messages).toEqual([]);
  });
  it("delete removes session", async () => { await deleteConsoleSession(sid); expect(await readConsoleSession(sid)).toBeNull(); });
});
