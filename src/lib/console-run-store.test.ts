import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetConsoleRunStoreForTests,
  appendConsoleRunEvent,
  consoleRunEventsAfter,
  createConsoleRun,
  finishConsoleRun,
  getActiveConsoleRun,
  getConsoleRun,
  toConsoleRunSnapshot,
} from "./console-run-store";

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
});
