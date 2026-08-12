import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DELETE, GET, POST, PUT } from "./route";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

const ACCT = "acct_test_journal_api";
const storeFile = path.join(
  process.cwd(),
  "data",
  "accounts",
  ACCT,
  "journal.json",
);

beforeEach(async () => {
  resetApiRateLimitForTests();
  try {
    await fs.unlink(storeFile);
  } catch {
    /* ok */
  }
});

afterEach(async () => {
  try {
    await fs.unlink(storeFile);
  } catch {
    /* ok */
  }
});

describe("/api/journal", () => {
  it("POST then GET then PUT then DELETE", async () => {
    const post = await POST(
      new Request("http://localhost/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          date: "2026-08-12",
          body: "One honest sentence.",
        }),
      }),
    );
    expect(post.status).toBe(200);
    const created = (await post.json()) as { item: { id: string; body: string } };
    expect(created.item.id).toMatch(/^je_/);

    const list = await GET(
      new Request(
        `http://localhost/api/journal?accountId=${encodeURIComponent(ACCT)}&month=2026-08`,
      ),
    );
    const listed = (await list.json()) as { items: unknown[] };
    expect(listed.items).toHaveLength(1);

    const put = await PUT(
      new Request("http://localhost/api/journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          id: created.item.id,
          body: "Updated sentence.",
        }),
      }),
    );
    const updated = (await put.json()) as { item: { body: string } };
    expect(updated.item.body).toBe("Updated sentence.");

    const del = await DELETE(
      new Request("http://localhost/api/journal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ACCT, id: created.item.id }),
      }),
    );
    expect((await del.json()).ok).toBe(true);
  });

  it("DELETE with creationId removes only the made block", async () => {
    const { appendCreationToJournal } = await import(
      "@/lib/entertain/journal-store"
    );
    const day = await appendCreationToJournal(
      ACCT,
      {
        id: "cr_route_made",
        type: "song",
        title: "Delete me from timeline",
        createdAt: Date.parse("2026-08-12T10:00:00"),
        accountId: ACCT,
        lyrics: "x",
      },
      "2026-08-12",
    );

    const del = await DELETE(
      new Request("http://localhost/api/journal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          id: day.id,
          creationId: "cr_route_made",
        }),
      }),
    );
    expect((await del.json()).ok).toBe(true);
  });

  it("DELETE requires an id", async () => {
    const del = await DELETE(
      new Request("http://localhost/api/journal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ACCT }),
      }),
    );
    expect(del.status).toBe(400);
  });
});
