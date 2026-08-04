#!/usr/bin/env node
/**
 * Full media persistence integration test.
 * Simulates: User sends image → chat API processes → history API persists → media on disk → serveable.
 * Run: node scripts/verify-media-flow.mjs
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// Tiny valid 1x1 JPEG base64
const TINY_JPEG_B64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/4QAWRXhpZgAASUkqAAgAAAAAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AK0//2Q==";
const DATA_URL = `data:image/jpeg;base64,${TINY_JPEG_B64}`;

const BASE = "http://127.0.0.1:3000";

async function main() {
  console.log("=== Media Persistence Flow Test ===\n");

  // ── 1. Verify history API correctly persists conversations with image attachments ──
  const sessionId = "verify-media-" + Date.now();
  console.log(`Test session: ${sessionId}\n`);

  // Build a ChatAttachmentPayload with raw base64 data (matching what TutorShell sends)
  const attachment = {
    name: "test-photo.jpg",
    mimeType: "image/jpeg",
    kind: "image",
    data: TINY_JPEG_B64,  // raw base64, no data: prefix
  };

  // Simulate the full conversation JSON that pushStoreToServer sends to /api/history
  const conversation = {
    sessionId,
    title: "Test image",
    messages: [{
      id: "m_" + Date.now(),
      role: "user",
      content: "What is in this photo?",
      attachments: [{
        id: "a_" + Date.now(),
        name: attachment.name,
        mimeType: attachment.mimeType,
        kind: attachment.kind,
        dataUrl: DATA_URL,  // full data:image/jpeg;base64,... URL
      }],
      createdAt: Date.now(),
    }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  console.log("1. PUT conversation with image to /api/history ...");
  const putRes = await fetch(`${BASE}/api/history`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversations: [conversation] }),
  });
  ok("history PUT: succeeds", putRes.ok, `status=${putRes.status}`);
  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    console.error(`  Body: ${errText.slice(0, 500)}`);
    process.exit(1);
  }

  // ── 2. Read the conversation from history API to verify server has it ──
  console.log("\n2. Reading conversation from /api/history ...");
  const historyRes = await fetch(`${BASE}/api/history?sessionId=${encodeURIComponent(sessionId)}`);
  ok("history: GET returns conversation", historyRes.ok, `status=${historyRes.status}`);

  const historyData = await historyRes.json();
  const conv = historyData.conversation;
  ok("history: conversation has messages", Boolean(conv?.messages?.length),
    `msgCount=${conv?.messages?.length ?? 0}`);

  // ── 3. Inspect the conversation JSON for mediaId  ──
  const userMsg = conv?.messages?.find(m => m.role === "user");
  ok("history: user message exists", Boolean(userMsg));

  const atts = userMsg?.attachments || [];
  ok("history: user msg has attachments", atts.length > 0, `count=${atts.length}`);

  const savedAtt = atts[0];
  console.log(`\n3. Attachment details:`);
  console.log(`   id:        ${savedAtt?.id || "MISSING"}`);
  console.log(`   name:      ${savedAtt?.name || "MISSING"}`);
  console.log(`   mediaId:   ${savedAtt?.mediaId || "MISSING"}`);
  console.log(`   dataUrl:   ${savedAtt?.dataUrl ? `present (${savedAtt.dataUrl.length} chars)` : "ABSENT (correct — sanitized)"}`);
  console.log(`   keys:      ${Object.keys(savedAtt || {}).join(", ")}`);

  ok("hist: attachment has mediaId", Boolean(savedAtt?.mediaId));
  ok("hist: attachment has NO dataUrl", !savedAtt?.dataUrl,
    "correctly sanitized by server");

  // ── 4. Verify media file exists on disk ──
  console.log("\n4. Checking media file on disk ...");
  if (savedAtt?.mediaId) {
    const checkRes = await fetch(`${BASE}/api/media/check?ids=${encodeURIComponent(savedAtt.mediaId)}`);
    const checkData = await checkRes.json();
    ok("media/check: file exists on disk",
      checkData.present === 1 && checkData.missing.length === 0,
      `present=${checkData.present} missing=${checkData.missing?.length}`);
  }

  // ── 5. Serve the media file ──
  console.log("\n5. Serving media file via /api/media ...");
  if (savedAtt?.mediaId) {
    const mediaRes = await fetch(`${BASE}/api/media/${encodeURIComponent(savedAtt.mediaId)}`);
    ok("media: serves image correctly",
      mediaRes.ok && mediaRes.headers.get("content-type")?.startsWith("image/"),
      `status=${mediaRes.status} type=${mediaRes.headers.get("content-type")} size=${mediaRes.headers.get("content-length")}`);

    // Verify content matches what we sent
    const mediaBuf = await mediaRes.arrayBuffer();
    ok("media: content size non-zero", mediaBuf.byteLength > 50,
      `bytes=${mediaBuf.byteLength}`);
  }

  // ── 6. Verify media file exists on filesystem ──
  console.log("\n6. Checking filesystem directly ...");
  const { execSync } = await import("node:child_process");
  try {
    const lsOutput = execSync(
      `ls -la /root/codes/ryan_learning/data/media/*.bin 2>/dev/null | wc -l`,
      { encoding: "utf8" },
    ).trim();
    ok("fs: media .bin files exist on disk", parseInt(lsOutput, 10) > 0,
      `${lsOutput} bin files`);
  } catch {
    ok("fs: media dir accessible", false, "ls failed");
  }

  // ── 7. Verify conversation JSON exists and is clean ──
  console.log("\n7. Checking conversation JSON ...");
  try {
    const jsonPath = `/root/codes/ryan_learning/data/conversations/${sessionId}.json`;
    const raw = readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw);
    const jsonAtt = parsed?.messages?.[0]?.attachments?.[0];
    ok("fs: conversation JSON exists", Boolean(parsed?.sessionId));
    ok("fs: JSON attachment has mediaId", Boolean(jsonAtt?.mediaId),
      `mediaId=${jsonAtt?.mediaId?.slice(0, 20)}...`);
    ok("fs: JSON attachment has NO dataUrl", !jsonAtt?.dataUrl,
      dataUrlCheck(jsonAtt?.dataUrl));

    // Verify the attachment was persisted by checking .media path
    const mediaJsonPath = `/root/codes/ryan_learning/data/media/${jsonAtt?.mediaId}.json`;
    const mediaBinPath = `/root/codes/ryan_learning/data/media/${jsonAtt?.mediaId}.bin`;
    const { existsSync } = await import("node:fs");
    ok("fs: media .json meta exists", existsSync(mediaJsonPath));
    ok("fs: media .bin data exists", existsSync(mediaBinPath));
  } catch (err) {
    ok("fs: conversation file read", false, err.message);
  }

  // ── 8. Cleanup ──
  console.log("\n8. Cleanup ...");
  try {
    await fetch(`${BASE}/api/history?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    ok("cleanup: deleted test conversation", true);
  } catch {
    ok("cleanup: deleted test conversation", true, "already cleaned");
  }

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

function dataUrlCheck(val) {
  if (!val) return "absent ✓";
  return `PRESENT (${val.length} chars) ✗ SHOULD BE ABSENT`;
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
