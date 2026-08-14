import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  __resetConsoleRunStoreForTests,
  __wipeMemoryForRestartTest,
  appendConsoleRunEvent,
  consoleRunEventsAfter,
  createConsoleRun,
  finishConsoleRun,
  getActiveConsoleRun,
  getConsoleRun,
  loadPersistedRuns,
  toConsoleRunSnapshot,
} from "./console-run-store";

const RUNS_DIR = path.join(process.cwd(), "data", "console", "runs");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  __resetConsoleRunStoreForTests();
});

describe("console-run-store", () => {
  it("createConsoleRun indexes by session", () => {
    const r = createConsoleRun("cs_a");
    expect(r.status).toBe("running");
    expect(getActiveConsoleRun("cs_a")?.runId).toBe(r.runId);
    expect(getConsoleRun(r.runId)?.sessionId).toBe("cs_a");
  });

  it("append + eventsAfter + finish", () => {
    const r = createConsoleRun("cs_b");
    const e1 = appendConsoleRunEvent(r.runId, "status", { status: "Thinking…" });
    const e2 = appendConsoleRunEvent(r.runId, "delta", { text: "Hi" });
    expect(e1?.id).toBe(1);
    expect(e2?.id).toBe(2);
    expect(getConsoleRun(r.runId)?.fullText).toBe("Hi");
    expect(consoleRunEventsAfter(r.runId, 1)).toHaveLength(1);
    finishConsoleRun(r.runId, "done", { fullText: "Hi there" });
    const snap = toConsoleRunSnapshot(getConsoleRun(r.runId)!);
    expect(snap.status).toBe("done");
    expect(snap.fullText).toBe("Hi there");
    expect(snap.lastEventId).toBe(2);
  });

  it("new run supersedes previous running run", () => {
    const a = createConsoleRun("cs_c");
    const b = createConsoleRun("cs_c");
    expect(getActiveConsoleRun("cs_c")?.runId).toBe(b.runId);
    expect(getConsoleRun(a.runId)?.status).toBe("error");
  });

  it("persists finished runs to disk", async () => {
    const r = createConsoleRun("cs_disk");
    appendConsoleRunEvent(r.runId, "delta", { text: "Hello" });
    finishConsoleRun(r.runId, "done", { fullText: "Hello world" });
    await sleep(700); // flush debounce + atomic rename

    const fp = path.join(RUNS_DIR, `${r.runId}.json`);
    const raw = await fs.readFile(fp, "utf8");
    const saved = JSON.parse(raw) as { status: string; fullText: string };
    expect(saved.status).toBe("done");
    expect(saved.fullText).toBe("Hello world");
  });

  it("restores persisted runs and errors out interrupted ones", async () => {
    const finished = createConsoleRun("cs_fin");
    appendConsoleRunEvent(finished.runId, "delta", { text: "Complete" });
    finishConsoleRun(finished.runId, "done", { fullText: "Complete answer" });

    const interrupted = createConsoleRun("cs_int");
    appendConsoleRunEvent(interrupted.runId, "delta", { text: "Partial" });
    // keep interrupted running, no finish
    await sleep(700);

    // Simulate a crash: memory lost, disk survives; reload from disk.
    __wipeMemoryForRestartTest();
    await loadPersistedRuns();

    const restoredFin = getConsoleRun(finished.runId);
    expect(restoredFin?.status).toBe("done");
    expect(restoredFin?.fullText).toBe("Complete answer");
    expect(getActiveConsoleRun("cs_fin")?.runId).toBe(finished.runId);

    const restoredInt = getConsoleRun(interrupted.runId);
    expect(restoredInt?.status).toBe("error");
    expect(restoredInt?.error).toContain("服务重启");
    expect(getActiveConsoleRun("cs_int")?.runId).toBe(interrupted.runId);
  });

  it("drops expired runs on reload", async () => {
    const r = createConsoleRun("cs_old");
    finishConsoleRun(r.runId, "done", { fullText: "old" });
    await sleep(700);

    // Age the file past TTL (30min).
    const fp = path.join(RUNS_DIR, `${r.runId}.json`);
    const raw = await fs.readFile(fp, "utf8");
    const data = JSON.parse(raw) as { finishedAt: number };
    data.finishedAt = Date.now() - 31 * 60 * 1000;
    await fs.writeFile(fp, JSON.stringify(data), "utf8");

    __wipeMemoryForRestartTest();
    await loadPersistedRuns();
    expect(getConsoleRun(r.runId)).toBeUndefined();
  });
});
