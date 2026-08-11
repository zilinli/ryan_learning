import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

// Return a fixed JSON so the route parses it as correct.
vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(async () => ({
      send: vi.fn(async () => ({
        // NOTE: stream must be a regular async generator, not wrapped in vi.fn,
        // because the route iterates it with `for await`.
        stream: async function* () {
          yield {
            type: "assistant" as const,
            message: {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    verdict: "correct",
                    feedback:
                      "Great answer! You identified the main idea clearly.",
                  }),
                },
              ],
            },
          };
        },
      })),
      close: vi.fn(),
    })),
  },
  CursorAgentError: class CursorAgentError extends Error {},
}));

function evalReq(body: unknown) {
  return new Request("http://localhost/api/ted/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ted/evaluate", () => {
  beforeEach(() => {
    resetApiRateLimitForTests();
    process.env.CURSOR_API_KEY = "test-key-0000";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns correct verdict for a well-structured answer", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      evalReq({
        talkSlug: "sir_ken_robinson_do_schools_kill_creativity",
        itemId: "i0",
        rubricHint: "State the main idea — not every detail.",
        studentAnswer:
          "The speaker says schools should value creativity as much as math because kids lose their creative confidence.",
        grade: 7,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.verdict).toBe("correct");
    expect(data.outcome).toBe("correct");
    expect(typeof data.feedback).toBe("string");
    expect(data.feedback.length).toBeGreaterThan(10);
  });

  it("returns needs-work for empty answer (no agent call)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      evalReq({
        rubricHint: "Name the topic in plain words.",
        studentAnswer: "",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verdict).toBe("needs-work");
    expect(data.outcome).toBe("incorrect");
    expect(data.feedback).toContain("guess");
  });

  it("rejects missing rubricHint", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      evalReq({
        studentAnswer: "I think it's about helping the environment.",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts minimal payload (rubric + answer)", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      evalReq({
        rubricHint: "Name the topic in plain words.",
        studentAnswer: "The talk is about saving the oceans.",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(["correct", "partial", "needs-work"]).toContain(data.verdict);
    expect(["correct", "practice", "incorrect"]).toContain(data.outcome);
  });
});
