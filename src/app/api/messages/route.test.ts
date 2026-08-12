import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DELETE, GET, POST } from "./route";

const ACCT = "acct_test_messages_api";
const storeFile = path.join(
  process.cwd(),
  "data",
  "accounts",
  ACCT,
  "messages.json",
);

beforeEach(async () => {
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

describe("/api/messages", () => {
  it("POST then GET then DELETE", async () => {
    const post = await POST(
      new Request("http://localhost/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAccountId: ACCT,
          fromAccountId: "acct_parent",
          fromName: "Dad",
          title: "Hello",
          body: "Line one\nLine two\n\nLine three",
          urgency: "important",
        }),
      }),
    );
    expect(post.status).toBe(200);
    const created = (await post.json()) as {
      message: { id: string; body: string };
    };
    expect(created.message.id).toMatch(/^msg_/);
    expect(created.message.body).toContain("Line two");

    const list = await GET(
      new Request(
        `http://localhost/api/messages?accountId=${encodeURIComponent(ACCT)}`,
      ),
    );
    const listed = (await list.json()) as { messages: unknown[] };
    expect(listed.messages).toHaveLength(1);

    const del = await DELETE(
      new Request("http://localhost/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          messageId: created.message.id,
        }),
      }),
    );
    expect((await del.json()).ok).toBe(true);

    const empty = await GET(
      new Request(
        `http://localhost/api/messages?accountId=${encodeURIComponent(ACCT)}`,
      ),
    );
    expect(
      ((await empty.json()) as { messages: unknown[] }).messages,
    ).toHaveLength(0);
  });
});
