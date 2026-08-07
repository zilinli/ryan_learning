import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  hydrateFromServer,
  pushStoreToServer,
  __resetDeletionCacheForTests,
} from "./history-sync";
import type { ConversationRecord, ConversationsStore } from "./types";

const AID = "acct_test_del_sync";

function record(sessionId: string, content: string): ConversationRecord {
  const now = Date.now();
  return {
    sessionId,
    title: content,
    messages: [
      { id: `m_${sessionId}`, role: "user", content, createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function staleStore(): ConversationsStore {
  return {
    version: 3,
    activeId: "s2",
    conversations: [record("s1", "deleted-elsewhere"), record("s2", "keep-me")],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  __resetDeletionCacheForTests();
});

describe("history-sync deletion cache", () => {
  it("hydrateFromServer strips tombstoned conversations from the local list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          conversations: [record("s2", "keep-me")],
          deletions: { s1: Date.now() },
        }),
      }),
    );
    const merged = await hydrateFromServer(staleStore(), AID);
    const ids = merged.conversations.map((c) => c.sessionId);
    expect(ids).not.toContain("s1");
    expect(ids).toContain("s2");
  });

  it("pushStoreToServer drops tombstoned sessions even when the caller store is stale", async () => {
    const fetchMock = vi
      .fn()
      // 1. hydration GET seeds the deletion cache with s1 tombstoned
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversations: [record("s2", "keep-me")],
          deletions: { s1: Date.now() },
        }),
      })
      // 2. push PUT — record what the client would send
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversations: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    // Hydrate once so the module caches the deletion map…
    await hydrateFromServer(staleStore(), AID);
    // …then push a stale store that still contains the deleted session.
    await pushStoreToServer(staleStore(), AID);

    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toContain("/api/history");
    expect(putCall[1]?.method).toBe("PUT");
    const body = JSON.parse(putCall[1]?.body as string) as {
      accountId: string;
      conversations: ConversationRecord[];
    };
    expect(body.accountId).toBe(AID);
    expect(body.conversations.map((c) => c.sessionId)).toEqual(["s2"]);
  });

  it("pushStoreToServer uploads everything when no tombstone is known", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ conversations: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await pushStoreToServer(staleStore(), AID);
    const putCall = fetchMock.mock.calls[0];
    const body = JSON.parse(putCall[1]?.body as string) as {
      conversations: ConversationRecord[];
    };
    expect(body.conversations.map((c) => c.sessionId).sort()).toEqual([
      "s1",
      "s2",
    ]);
  });
});
