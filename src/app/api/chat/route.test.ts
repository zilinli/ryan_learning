import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock dependencies — factories use vi.fn() directly to avoid hoisting issues
vi.mock("@/lib/attachments", () => ({
  normalizeIncomingAttachments: vi.fn(() => []),
  stripDataUrlPrefix: vi.fn((data: string) => data),
}));

vi.mock("@/lib/extract-files", () => ({
  buildFileSummaries: vi.fn(() => ""),
}));

vi.mock("@/lib/cursor-agent", () => ({
  hasCursorApiKey: vi.fn(() => true),
  streamTutorReply: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  buildTutorPrompt: vi.fn(() => "system prompt for test"),
}));

vi.mock("@/lib/student-profile", () => ({
  DEFAULT_STUDENT_PROFILE: {
    name: "Ryan",
    grade: "G4",
    school: "BASIS",
    preferredChinese: "yue",
    subjects: [],
  },
}));

vi.mock("@/lib/tutor-text-filter", () => ({
  filterTutorDelta: vi.fn((d: string) => d),
  preferCompleteTutorText: vi.fn(
    (streamed: string, final: string) => final || streamed,
  ),
  scrubTutorVisibleText: vi.fn((t: string) => t),
}));

vi.mock("@/lib/tutor-harness", () => ({
  statusLabelForTool: vi.fn(() => "Working…"),
}));

vi.mock("@/lib/learning-memory", () => ({
  mergeLearningMemory: vi.fn(
    (server: unknown, client: unknown) => client || server,
  ),
  normalizeMemory: vi.fn((m: unknown) => m),
}));

vi.mock("@/lib/learning-memory-store", () => ({
  readServerLearningMemory: vi.fn(() =>
    Promise.resolve({
      version: 1,
      topics: [],
      lastMessageId: "",
      lastMergedAt: 0,
    }),
  ),
}));

import { POST } from "./route";
import * as cursorAgent from "@/lib/cursor-agent";
import * as attachments from "@/lib/attachments";
import * as prompts from "@/lib/prompts";

async function readSseStream(
  response: Response,
): Promise<{ events: Array<{ event: string; data: unknown }> }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Array<{ event: string; data: unknown }> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split("\n");
      let event = "message";
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      const data = JSON.parse(dataLine);
      events.push({ event, data });
    }
  }

  return { events };
}

function makeMockRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cursorAgent.hasCursorApiKey).mockReturnValue(true);
    vi.mocked(attachments.normalizeIncomingAttachments).mockReturnValue([]);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 for missing sessionId", async () => {
    const res = await POST(makeMockRequest({ message: "hello" }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing sessionId");
  });

  it("returns 400 for empty message with no attachments", async () => {
    const res = await POST(
      makeMockRequest({ sessionId: "test", message: "  " }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Type a message");
  });

  it("returns 400 for empty image attachment data", async () => {
    vi.mocked(attachments.normalizeIncomingAttachments).mockReturnValue([
      {
        kind: "image",
        name: "empty.jpg",
        mimeType: "image/jpeg",
        data: "x",
        textContent: null as string | null,
      } as any,
    ]);

    const res = await POST(
      makeMockRequest({
        sessionId: "test",
        message: "Check this photo",
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("empty");
  });

  it("returns 503 when API key is not configured", async () => {
    vi.mocked(cursorAgent.hasCursorApiKey).mockReturnValue(false);

    const res = await POST(
      makeMockRequest({ sessionId: "test", message: "Help" }),
    );

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("API Key");
  });

  it("streams status and done events on success", async () => {
    vi.mocked(cursorAgent.hasCursorApiKey).mockReturnValue(true);

    vi.mocked(cursorAgent.streamTutorReply).mockImplementation(
      async (params) => {
        (params as any).handlers.onStatus("Searching…");
        (params as any).handlers.onText("Here is the answer. ");
        (params as any).handlers.onText("It's step by step.");
        return {
          agentId: "agent-1",
          fullText: "Here is the answer. It's step by step.",
        };
      },
    );

    const res = await POST(
      makeMockRequest({
        sessionId: "test-stream",
        message: "How do I solve this?",
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const { events } = await readSseStream(res);

    const doneEvent = events.find((e) => e.event === "done");
    expect(doneEvent).toBeDefined();

    if (doneEvent) {
      const doneData = doneEvent.data as { agentId: string; text: string };
      expect(doneData.agentId).toBe("agent-1");
      expect(doneData.text).toBeTruthy();
    }

    const deltas = events.filter((e) => e.event === "delta");
    expect(deltas.length).toBeGreaterThan(0);
  });

  it("sends error event on agent failure", async () => {
    vi.mocked(cursorAgent.hasCursorApiKey).mockReturnValue(true);
    vi.mocked(cursorAgent.streamTutorReply).mockRejectedValue(
      new Error("Agent timeout"),
    );

    const res = await POST(
      makeMockRequest({
        sessionId: "test-error",
        message: "Help",
      }),
    );

    expect(res.status).toBe(200);

    const { events } = await readSseStream(res);
    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent) {
      const errorData = errorEvent.data as { error: string };
      expect(errorData.error).toContain("Agent timeout");
    }
  });

  it("passes learning memory to prompt builder", async () => {
    vi.mocked(cursorAgent.hasCursorApiKey).mockReturnValue(true);
    vi.mocked(prompts.buildTutorPrompt).mockClear();
    vi.mocked(cursorAgent.streamTutorReply).mockResolvedValue({
      agentId: "agent-3",
      fullText: "Hello!",
    } as any);

    await POST(
      makeMockRequest({
        sessionId: "test-memory",
        message: "Continue",
        learningMemory: {
          version: 1,
          topics: [
            {
              id: "math-fractions",
              subject: "math",
              pKnown: 0.75,
              pGuess: 0.15,
              pSlip: 0.1,
              lastSeen: Date.now(),
              attempts: 5,
              sm2Interval: 3,
              sm2Easiness: 2.5,
              eloRating: 1200,
            },
          ],
          lastMergedAt: 0,
        },
      }),
    );

    expect(prompts.buildTutorPrompt).toHaveBeenCalled();
    const calls = vi.mocked(prompts.buildTutorPrompt).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
  });

  it("handles text-only messages successfully", async () => {
    vi.mocked(cursorAgent.hasCursorApiKey).mockReturnValue(true);
    vi.mocked(cursorAgent.streamTutorReply).mockResolvedValue({
      agentId: "agent-text",
      fullText: "Sure, let me help you.",
    } as any);

    const res = await POST(
      makeMockRequest({
        sessionId: "test-text",
        message: "Hi there!",
      }),
    );

    expect(res.status).toBe(200);
    const { events } = await readSseStream(res);
    expect(events.some((e) => e.event === "done")).toBe(true);
  });
});
