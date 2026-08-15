import { describe, it, expect, vi, afterEach } from "vitest";
import * as photoVault from "./photo-vault";
import type { ChatAttachment, ConversationsStore } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function attachment(
  partial: Partial<ChatAttachment> & Pick<ChatAttachment, "id">,
): ChatAttachment {
  return {
    kind: "file",
    mimeType: "",
    name: "",
    ...partial,
  };
}

function storeWith(a: ChatAttachment): ConversationsStore {
  return {
    version: 3,
    activeId: "s1",
    conversations: [
      {
        sessionId: "s1",
        title: "t",
        createdAt: 1,
        updatedAt: 1,
        messages: [
          {
            id: "m1",
            role: "user",
            content: "x",
            createdAt: 1,
            attachments: [a],
          },
        ],
      },
    ],
  };
}

/** Minimal in-memory IndexedDB shim so get/put/delete in photo-vault really run. */
function installFakeIdb(seed: Record<string, Record<string, unknown>> = {}) {
  const data = new Map<string, Record<string, unknown>>(Object.entries(seed));

  const db: any = {
    objectStoreNames: { contains: (n: string) => n === "photos" },
    createObjectStore: () => {},
    close: () => {},
    transaction(_name: string, _mode: string) {
      const tx: any = {};
      tx.objectStore = () => storeApi;
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };
  const storeApi = {
    get: (id: string) => ({ result: data.get(id) }),
    put: (v: Record<string, unknown>) => {
      data.set(String(v.id), v);
      return { result: v.id };
    },
    delete: (id: string) => {
      data.delete(id);
      return { result: undefined };
    },
  };

  vi.stubGlobal("indexedDB", {
    open: () => {
      const req: any = { result: db };
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  });
  return data;
}

describe("photo-vault large-binary guard", () => {
  it("restoreStorePhotosFromVault skips videos and drops stale vault entries", async () => {
    const data = installFakeIdb({
      v1: {
        id: "v1",
        dataUrl: "data:video/mp4;base64,BIGVIDEOBYTES",
        mimeType: "video/mp4",
        name: "clip.mp4",
        updatedAt: 1,
      },
    });

    const out = await photoVault.restoreStorePhotosFromVault(
      storeWith(
        attachment({
          id: "v1",
          name: "clip.mp4",
          mimeType: "video/mp4",
          mediaId: "m1",
        }),
      ),
    );

    // Never rehydrates a dataUrl for a large binary.
    expect(out.conversations[0].messages[0].attachments?.[0]?.dataUrl).toBe(
      undefined,
    );
    // …and it proactively deletes the stale vault entry left by an older client
    // (deletion is fire-and-forget, so flush microtasks first).
    await new Promise((r) => setTimeout(r, 0));
    expect(data.has("v1")).toBe(false);
  });

  it("restoreStorePhotosFromVault treats PDF and Office the same way", async () => {
    const data = installFakeIdb({
      d1: {
        id: "d1",
        dataUrl: "data:application/pdf;base64,BIGPDF",
        mimeType: "application/pdf",
        name: "hw.pdf",
        updatedAt: 1,
      },
    });

    const out = await photoVault.restoreStorePhotosFromVault(
      storeWith(
        attachment({
          id: "d1",
          name: "hw.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          mediaId: "m2",
        }),
      ),
    );

    expect(out.conversations[0].messages[0].attachments?.[0]?.dataUrl).toBe(
      undefined,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(data.has("d1")).toBe(false);
  });

  it("restoreStorePhotosFromVault still restores image dataUrls", async () => {
    installFakeIdb({
      p1: {
        id: "p1",
        dataUrl: "data:image/jpeg;base64,AAA",
        mimeType: "image/jpeg",
        name: "p.jpg",
        updatedAt: 1,
      },
    });

    const out = await photoVault.restoreStorePhotosFromVault(
      storeWith(
        attachment({
          id: "p1",
          name: "p.jpg",
          mimeType: "image/jpeg",
          kind: "image",
        }),
      ),
    );

    expect(out.conversations[0].messages[0].attachments?.[0]?.dataUrl).toBe(
      "data:image/jpeg;base64,AAA",
    );
  });

  it("fetchMissingPhotosFromServer skips large binaries (no network)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const store = storeWith(
      attachment({
        id: "v1",
        name: "clip.mp4",
        mimeType: "video/mp4",
        mediaId: "m1",
      }),
    );
    const out = await photoVault.fetchMissingPhotosFromServer(store);

    expect(fetchMock).not.toHaveBeenCalled();
    // Unchanged — no dataUrl was built for the binary.
    expect(out).toBe(store);
  });

  it("fetchMissingPhotosFromServer still fetches images with a mediaId", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await photoVault.fetchMissingPhotosFromServer(
      storeWith(
        attachment({
          id: "p1",
          name: "p.jpg",
          mimeType: "image/jpeg",
          kind: "image",
          mediaId: "m1",
        }),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
