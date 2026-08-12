import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GET, POST, DELETE } from "./route";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

const ACCT = "acct_test_creations_api";
const storeFile = path.join(
  process.cwd(),
  "data",
  "accounts",
  ACCT,
  "creations.json",
);
const journalFile = path.join(
  process.cwd(),
  "data",
  "accounts",
  ACCT,
  "journal.json",
);

async function wipe() {
  for (const f of [storeFile, journalFile]) {
    try {
      await fs.unlink(f);
    } catch {
      /* ok */
    }
  }
}

beforeEach(async () => {
  resetApiRateLimitForTests();
  await wipe();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await wipe();
});

describe("/api/creations", () => {
  it("GET returns empty list", async () => {
    const res = await GET(
      new Request(
        `http://localhost/api/creations?accountId=${encodeURIComponent(ACCT)}`,
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.items).toEqual([]);
  });

  it("POST song then DELETE", async () => {
    const post = await POST(
      new Request("http://localhost/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          type: "song",
          title: "Draft",
          lyrics: "[Verse]\nhello",
          caption: "Indie",
        }),
      }),
    );
    expect(post.status).toBe(200);
    const created = await post.json();
    expect(created.item.id).toBeTruthy();
    expect(created.item.type).toBe("song");

    const journalRaw = JSON.parse(await fs.readFile(journalFile, "utf8")) as {
      items: Array<{ made: Array<{ creationId?: string }> }>;
    };
    const madeIds = journalRaw.items.flatMap((e) =>
      e.made.map((m) => m.creationId),
    );
    expect(madeIds).toContain(created.item.id);

    const list = await GET(
      new Request(
        `http://localhost/api/creations?accountId=${encodeURIComponent(ACCT)}`,
      ),
    );
    const listed = await list.json();
    expect(listed.items).toHaveLength(1);

    const del = await DELETE(
      new Request("http://localhost/api/creations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ACCT, id: created.item.id }),
      }),
    );
    expect((await del.json()).ok).toBe(true);

    const empty = await (
      await GET(
        new Request(
          `http://localhost/api/creations?accountId=${encodeURIComponent(ACCT)}`,
        ),
      )
    ).json();
    expect(empty.items).toHaveLength(0);
  });

  it("DELETE frees linked audioMediaId blob", async () => {
    const { writeMediaBytes, readMedia } = await import("@/lib/media-store");
    const mediaId = `song_del_${Date.now()}`;
    await writeMediaBytes(mediaId, Buffer.from("ID3del"), "audio/mpeg", {
      sessionId: "writing-studio",
      messageId: "generate",
      attachmentId: mediaId,
      name: "bye.mp3",
      kind: "file",
      accountId: ACCT,
    });
    expect(await readMedia(mediaId)).not.toBeNull();

    const post = await POST(
      new Request("http://localhost/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          type: "song",
          title: "With audio",
          lyrics: "[Verse]\nhello world enough",
          audioMediaId: mediaId,
        }),
      }),
    );
    const created = await post.json();
    expect(created.item.audioMediaId).toBe(mediaId);

    const del = await DELETE(
      new Request("http://localhost/api/creations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ACCT, id: created.item.id }),
      }),
    );
    expect((await del.json()).ok).toBe(true);
    expect(await readMedia(mediaId)).toBeNull();
  });

  it("POST rejects invalid type", async () => {
    const res = await POST(
      new Request("http://localhost/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: ACCT, type: "meme", title: "x" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST ted_challenge", async () => {
    const res = await POST(
      new Request("http://localhost/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ACCT,
          type: "ted_challenge",
          title: "TED · Demo",
          talkSlug: "susan_cain_the_power_of_introverts",
          challengeScore: "3/5 answered",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.talkSlug).toContain("susan_cain");
  });
});
