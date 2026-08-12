import { describe, expect, it, vi } from "vitest";
import { readResponseJson } from "./api-json";

describe("readResponseJson", () => {
  it("parses JSON bodies", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(readResponseJson(res)).resolves.toEqual({ ok: true });
  });

  it("maps plain Internal Server Error to a friendly message", async () => {
    const res = new Response("Internal Server Error", { status: 500 });
    await expect(readResponseJson(res)).rejects.toThrow(
      /Server briefly unavailable/,
    );
  });
});
