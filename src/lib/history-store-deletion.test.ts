import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  deleteServerConversation,
  getServerConversation,
  upsertServerConversation,
  upsertServerConversations,
} from "./history-store";
import { readDeletionLog } from "./deletion-log";
import type { ConversationRecord } from "./types";

const AID = "_test_del_guard_1";
const HISTORY_DIR = path.join(process.cwd(), "data", "history", AID);
const DELETIONS_FILE = path.join(
  process.cwd(),
  "data",
  "deletions",
  `${AID}.json`,
);

function conv(sessionId: string, text = "hello"): ConversationRecord {
  const now = Date.now();
  return {
    sessionId,
    title: text,
    messages: [
      {
        id: `m_${sessionId}`,
        role: "user",
        content: text,
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

afterAll(async () => {
  try {
    await fs.rm(HISTORY_DIR, { recursive: true, force: true });
  } catch {}
  try {
    await fs.unlink(DELETIONS_FILE);
  } catch {}
});

describe("history-store deletion sync guard", () => {
  it("delete removes the conversation file and writes a tombstone", async () => {
    const a = await upsertServerConversation(conv("sess_del_1"), AID);
    expect(a).not.toBeNull();
    expect(await getServerConversation("sess_del_1", AID)).not.toBeNull();

    const ok = await deleteServerConversation("sess_del_1", AID);
    expect(ok).toBe(true);
    expect(await getServerConversation("sess_del_1", AID)).toBeNull();

    const log = await readDeletionLog(AID);
    expect(log["sess_del_1"]).toBeTypeOf("number");
  });

  it("upsert of a tombstoned session is rejected — no resurrection", async () => {
    // Delete first (writes tombstone even though the file never existed)
    await deleteServerConversation("sess_del_2", AID);
    const again = await upsertServerConversation(conv("sess_del_2", "zombie"), AID);
    expect(again).toBeNull();
    expect(await getServerConversation("sess_del_2", AID)).toBeNull();
  });

  it("batch upsert skips tombstoned sessions but saves fresh ones", async () => {
    await deleteServerConversation("sess_del_3", AID);
    const saved = await upsertServerConversations(
      [conv("sess_del_3", "zombie"), conv("sess_fresh_3", "fresh")],
      AID,
    );
    expect(saved.map((s) => s.sessionId)).toEqual(["sess_fresh_3"]);
    expect(await getServerConversation("sess_del_3", AID)).toBeNull();
    expect(await getServerConversation("sess_fresh_3", AID)).not.toBeNull();
  });

  it("non-tombstoned upsert still works alongside tombstones", async () => {
    const saved = await upsertServerConversation(conv("sess_keep_1"), AID);
    expect(saved).not.toBeNull();
    expect(await getServerConversation("sess_keep_1", AID)).not.toBeNull();
  });
});
