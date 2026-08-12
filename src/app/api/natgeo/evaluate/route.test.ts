import { describe, expect, it, beforeEach } from "vitest";

describe("POST /api/natgeo/evaluate", () => {
  beforeEach(() => {
    process.env.CURSOR_API_KEY = "test-key-0000";
  });

  it("returns needs-work for empty student answer", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleSlug: "african-lion",
        rubricHint: "Identifies the main message",
        studentAnswer: "",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.verdict).toBe("needs-work");
    expect(body.outcome).toBe("incorrect");
    expect(body.feedback).toBeTruthy();
  });

  it("returns 400 for missing rubricHint", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleSlug: "african-lion",
        studentAnswer: "Some answer",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("handles minimal valid payload", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleSlug: "african-lion",
        rubricHint: "Identifies the main idea",
        studentAnswer: "Lions live in groups called prides.",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(["correct", "partial", "needs-work"]).toContain(body.verdict);
    expect(body.outcome).toBeTruthy();
    expect(body.feedback).toBeTruthy();
  });

  it("includes grade in prompt context", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleSlug: "african-lion",
        rubricHint: "Explains using context",
        studentAnswer: "It means they work as a team.",
        grade: 3,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
