import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DELETE, GET, PATCH, POST, PUT } from "./route";
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

  it("scope=all aggregates every account's journal with author names", async () => {
    const OTHER = "acct_test_journal_api2";
    const otherFile = path.join(
      process.cwd(),
      "data",
      "accounts",
      OTHER,
      "journal.json",
    );
    try {
      await fs.unlink(otherFile);
    } catch {
      /* ok */
    }
    try {
      // Two accounts each create one entry
      await POST(
        new Request("http://localhost/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: ACCT, body: "Mine." }),
        }),
      );
      await POST(
        new Request("http://localhost/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: OTHER, body: "Theirs." }),
        }),
      );

      const res = await GET(
        new Request("http://localhost/api/journal?scope=all"),
      );
      const data = (await res.json()) as {
        ok?: boolean;
        items?: Array<{ accountId: string; authorName?: string; body: string }>;
      };
      expect(data.ok).toBe(true);
      expect(data.items).toBeDefined();
      const ids = new Set((data.items || []).map((i) => i.accountId));
      expect(ids.has(ACCT)).toBe(true);
      expect(ids.has(OTHER)).toBe(true);
      // Unknown account → authorName falls back to the accountId
      const other = (data.items || []).find((i) => i.accountId === OTHER);
      expect(other).toBeDefined();
      expect(other!.authorName).toBe(OTHER);
    } finally {
      try {
        await fs.unlink(otherFile);
      } catch {
        /* ok */
      }
    }
  });

  it("V2 P2 — PATCH praise toggles a like and writes a note", async () => {
    const OTHER = "acct_test_journal_api2";
    const otherFile = path.join(
      process.cwd(),
      "data",
      "accounts",
      OTHER,
      "journal.json",
    );
    try {
      await fs.unlink(otherFile);
    } catch {
      /* ok */
    }
    try {
      const post = await POST(
        new Request("http://localhost/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: OTHER, body: "Theirs." }),
        }),
      );
      const created = (await post.json()) as { item: { id: string } };

      const patch = await PATCH(
        new Request("http://localhost/api/journal", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetAccountId: OTHER,
            fromAccountId: ACCT,
            id: created.item.id,
            note: "So creative!",
          }),
        }),
      );
      expect(patch.status).toBe(200);
      const praised = (await patch.json()) as {
        item: { praise?: { count: number; notes: unknown[] } };
      };
      expect(praised.item.praise?.count).toBe(1);
      expect(praised.item.praise?.notes.length).toBe(1);

      // Toggle off: same person praises again with no note → like removed
      const off = await PATCH(
        new Request("http://localhost/api/journal", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetAccountId: OTHER,
            fromAccountId: ACCT,
            id: created.item.id,
          }),
        }),
      );
      const toggled = (await off.json()) as {
        item: { praise?: { count: number } };
      };
      expect(toggled.item.praise?.count).toBe(0);
    } finally {
      try {
        await fs.unlink(otherFile);
      } catch {
        /* ok */
      }
    }
  });

  it("V2 P2 — PATCH rejects self-praise and missing ids", async () => {
    const post = await POST(
      new Request("http://localhost/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ACCT, body: "Mine." }),
      }),
    );
    const created = (await post.json()) as { item: { id: string } };

    const self = await PATCH(
      new Request("http://localhost/api/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAccountId: ACCT,
          fromAccountId: ACCT,
          id: created.item.id,
        }),
      }),
    );
    expect(self.status).toBe(400);

    const missing = await PATCH(
      new Request("http://localhost/api/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAccountId: ACCT, fromAccountId: ACCT }),
      }),
    );
    expect(missing.status).toBe(400);
  });
});
