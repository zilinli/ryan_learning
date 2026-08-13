import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { statSync } from "node:fs";
import path from "node:path";
import { GET, PUT } from "./route";
import { readServerInterests } from "@/lib/interest-store-server";

const ACCT = "acct_test_interest_api";
const storeFile = path.join(
  process.cwd(),
  "data",
  "interests",
  `${ACCT}.json`,
);
const defaultFile = path.join(process.cwd(), "data", "interests-default.json");
const hadDefaultFile = (() => {
  try {
    statSync(defaultFile);
    return true;
  } catch {
    return false;
  }
})();

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
  if (!hadDefaultFile) {
    try {
      await fs.unlink(defaultFile);
    } catch {
      /* ok */
    }
  }
});

describe("/api/interest (V3 cross-device interest persistence)", () => {
  it("PUT merges client interests and GET returns them", async () => {
    const put = await PUT(
      new Request("http://localhost/api/interest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          interests: [
            {
              topicId: "space",
              label: "Space & planets",
              emoji: "🚀",
              exploredAt: 2000,
              count: 2,
            },
            {
              topicId: "dinos",
              label: "Dinosaurs",
              emoji: "🦕",
              exploredAt: 1000,
              count: 1,
            },
          ],
        }),
      }),
    );
    expect(put.status).toBe(200);
    const saved = (await put.json()) as { ok: boolean; interests: unknown[] };
    expect(saved.ok).toBe(true);
    expect(saved.interests).toHaveLength(2);

    const get = await GET(
      new Request(
        `http://localhost/api/interest?accountId=${encodeURIComponent(ACCT)}`,
      ),
    );
    const listed = (await get.json()) as { interests: unknown[] };
    expect(listed.interests).toHaveLength(2);
    expect(
      (listed.interests[0] as { topicId: string }).topicId,
    ).toBe("space");
  });

  it("PUT unions with what the server already has (no double count)", async () => {
    await PUT(
      new Request("http://localhost/api/interest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          interests: [
            {
              topicId: "space",
              label: "Space & planets",
              emoji: "🚀",
              exploredAt: 1000,
              count: 2,
            },
          ],
        }),
      }),
    );
    // device B bumps space and adds music
    const put = await PUT(
      new Request("http://localhost/api/interest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          interests: [
            {
              topicId: "space",
              label: "Space & planets",
              emoji: "🚀",
              exploredAt: 3000,
              count: 5,
            },
            {
              topicId: "music",
              label: "Music",
              emoji: "🎵",
              exploredAt: 3000,
              count: 1,
            },
          ],
        }),
      }),
    );
    const saved = (await put.json()) as {
      interests: Array<{ topicId: string; count: number; exploredAt: number }>;
    };
    expect(saved.interests).toHaveLength(2);
    const space = saved.interests.find((i) => i.topicId === "space");
    expect(space?.count).toBe(5);
    expect(space?.exploredAt).toBe(3000);
  });

  it("PUT rejects a non-array interests payload", async () => {
    const bad = await PUT(
      new Request("http://localhost/api/interest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ACCT, interests: "space" }),
      }),
    );
    expect(bad.status).toBe(400);
  });

  it("acct_ryan maps to the default file (backward compat)", async () => {
    await PUT(
      new Request("http://localhost/api/interest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "acct_ryan",
          interests: [
            {
              topicId: "space",
              label: "Space & planets",
              emoji: "🚀",
              exploredAt: 1000,
              count: 1,
            },
          ],
        }),
      }),
    );
    const read = await readServerInterests("default");
    expect(read.some((i) => i.topicId === "space")).toBe(true);
  });
});
