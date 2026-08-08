import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  hydrateFromServer,
  pushStoreToServer,
  repairMissingMedia,
  checkMissingMedia,
  collectStoreMediaIds,
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

/** Conversation with one attachment that has both mediaId and dataUrl. */
function mediaChat(sessionId: string, mediaId: string, dataUrl: string): ConversationRecord {
  const now = Date.now();
  return {
    sessionId,
    title: "homework",
    messages: [
      {
        id: `m_${sessionId}`,
        role: "user",
        content: "photo",
        createdAt: now,
        attachments: [
          {
            id: `a_${sessionId}`,
            name: "p.jpg",
            mimeType: "image/jpeg",
            kind: "image",
            mediaId,
            dataUrl,
          },
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
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

describe("history-sync media repair", () => {
  it("collectStoreMediaIds gathers every attachment mediaId", () => {
    const store: ConversationsStore = {
      version: 3,
      activeId: "a",
      conversations: [
        mediaChat("a", "media_aaa", "data:image/jpeg;base64,AAAA"),
        mediaChat("b", "media_bbb", "data:image/jpeg;base64,BBBB"),
      ],
    };
    expect(collectStoreMediaIds(store).sort()).toEqual(["media_aaa", "media_bbb"]);
  });

  it("checkMissingMedia queries /api/media/check and returns the missing set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ missing: ["media_bbb"] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const missing = await checkMissingMedia(["media_aaa", "media_bbb"]);
    expect(missing.has("media_bbb")).toBe(true);
    expect(missing.has("media_aaa")).toBe(false);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("/api/media/check");
    expect(call[0]).toContain("ids=media_aaa%2Cmedia_bbb");
  });

  it("repairMissingMedia re-uploads chats whose media is missing, scoped to the account", async () => {
    const present = mediaChat("present", "media_present", "data:image/jpeg;base64,PRESENT");
    const missingChat = mediaChat("missing", "media_missing", "data:image/jpeg;base64,MISSING");
    const store: ConversationsStore = {
      version: 3,
      activeId: "missing",
      conversations: [present, missingChat],
    };
    const fetchMock = vi
      .fn()
      // /api/media/check — only media_missing is gone on the server
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ missing: ["media_missing"] }),
      })
      // PUT /api/history — the repair upload
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversations: [missingChat] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { repaired } = await repairMissingMedia(store, AID);
    expect(repaired).toBe(1);

    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toContain("/api/history");
    expect(putCall[1]?.method).toBe("PUT");
    const body = JSON.parse(putCall[1]?.body as string) as {
      accountId: string;
      conversations: ConversationRecord[];
    };
    expect(body.accountId).toBe(AID);
    // Only the conversation with missing media is re-uploaded
    expect(body.conversations.map((c) => c.sessionId)).toEqual(["missing"]);
  });

  it("repairMissingMedia does nothing when all media exists on the server", async () => {
    const store: ConversationsStore = {
      version: 3,
      activeId: "ok",
      conversations: [mediaChat("ok", "media_ok", "data:image/jpeg;base64,OK")],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ missing: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { repaired } = await repairMissingMedia(store, AID);
    expect(repaired).toBe(0);
    // No PUT should be issued
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PUT")).toBe(false);
  });

  it("repairMissingMedia skips chats with mediaId but no local dataUrl (nothing to upload)", async () => {
    const noDataUrl: ConversationRecord = {
      sessionId: "nodata",
      title: "no data",
      messages: [
        {
          id: "m_nodata",
          role: "user",
          content: "photo",
          createdAt: Date.now(),
          attachments: [
            {
              id: "a_nodata",
              name: "p.jpg",
              mimeType: "image/jpeg",
              kind: "image",
              mediaId: "media_nodata",
              // no dataUrl — the browser does NOT have the bytes
            },
          ],
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ missing: ["media_nodata"] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { repaired } = await repairMissingMedia(
      { version: 3, activeId: "nodata", conversations: [noDataUrl] },
      AID,
    );
    expect(repaired).toBe(0);
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PUT")).toBe(false);
  });
});
