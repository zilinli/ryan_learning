#!/usr/bin/env node
/**
 * Media integrity test — verifies /api/media/check and repair flow.
 * Run: node scripts/verify-media.mjs
 */
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const BASE = "http://127.0.0.1:3000";

async function main() {
  console.log("=== Media Integrity Verification ===\n");

  // ── 1. Test /api/media/check with no params ──
  {
    const res = await fetch(`${BASE}/api/media/check`);
    const data = await res.json();
    ok("check: no-params returns ok", res.ok && data.ok && data.missing.length === 0,
      `missing=${data.missing?.length ?? "?"}`);
  }

  // ── 2. Test /api/media/check with known missing IDs ──
  {
    const ids = [
      "e6b00a40-4dd0-42f5-948b-_d23fdbf0d08e579dc8d385cd",
      "ca952235-1322-4420-9400-_378478eb2b3625c699db2ab8",
      "nonexistent-fake-media-id-001"
    ];
    const res = await fetch(`${BASE}/api/media/check?ids=${encodeURIComponent(ids.join(","))}`);
    const data = await res.json();
    ok("check: reports missing orphaned ids",
      res.ok && data.ok && data.missing.length === 3,
      `total=${data.total} present=${data.present} missing=${data.missing?.length}`);
  }

  // ── 3. Test /api/media/check with existing ID ──
  {
    const res = await fetch(`${BASE}/api/media/check?ids=test-img-001`);
    const data = await res.json();
    ok("check: reports existing media",
      res.ok && data.ok && data.present === 1 && data.missing.length === 0,
      `present=${data.present} missing=${data.missing?.length}`);
  }

  // ── 4. Test /api/media/:id serves image correctly ──
  {
    const res = await fetch(`${BASE}/api/media/test-img-001`);
    ok("media: serves existing image",
      res.ok && res.headers.get("content-type") === "image/jpeg",
      `status=${res.status} type=${res.headers.get("content-type")}`);
  }

  // ── 5. Test /api/media/:id returns 404 for missing ──
  {
    const res = await fetch(`${BASE}/api/media/nonexistent-fake-media-id-001`);
    ok("media: 404 for missing",
      res.status === 404,
      `status=${res.status}`);
  }

  // ── 6. Simulate repair: PUT conversation with dataUrl → media persisted ──
  {
    // Create a tiny test image as base64 dataUrl
    const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const dataUrl = `data:image/png;base64,${tinyPng}`;
    const sessionId = "test-media-repair-" + Date.now();
    const msgId = "m_" + Date.now();
    const attId = "a_" + Date.now();

    // Build mediaId the same way media-store does
    const raw = `${sessionId}|${msgId}|${attId}`;
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 24);
    const safeSeg = sessionId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 24);
    const expectedMediaId = `${safeSeg}_${hash}`;

    const conversation = {
      sessionId,
      title: "Test repair",
      messages: [{
        id: msgId,
        role: "user",
        content: "Test image",
        attachments: [{
          id: attId,
          name: "test.png",
          mimeType: "image/png",
          kind: "image",
          dataUrl,
        }],
        createdAt: Date.now(),
      }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // PUT the conversation with dataUrl
    const putRes = await fetch(`${BASE}/api/history`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation }),
    });
    ok("repair: PUT conversation succeeds",
      putRes.ok,
      `status=${putRes.status}`);

    if (putRes.ok) {
      const putData = await putRes.json();
      const savedConv = putData.conversation;

      // Verify mediaId was assigned
      const savedAttachment = savedConv?.messages?.[0]?.attachments?.[0];
      ok("repair: mediaId assigned",
        Boolean(savedAttachment?.mediaId),
        `mediaId=${savedAttachment?.mediaId?.slice(0, 20)}...`);

      // Verify media file exists via /api/media/check
      const checkRes = await fetch(`${BASE}/api/media/check?ids=${savedAttachment?.mediaId}`);
      const checkData = await checkRes.json();
      ok("repair: media file persisted to disk",
        checkData.present === 1 && checkData.missing.length === 0,
        `present=${checkData.present} missing=${checkData.missing?.length}`);

      // Verify it can be served
      const getRes = await fetch(`${BASE}/api/media/${savedAttachment?.mediaId}`);
      ok("repair: persisted image is serveable",
        getRes.ok && getRes.headers.get("content-type")?.startsWith("image/"),
        `status=${getRes.status} type=${getRes.headers.get("content-type")}`);

      // Cleanup
      try {
        await fetch(`${BASE}/api/history?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      } catch {}
    }
  }

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
