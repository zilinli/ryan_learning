#!/usr/bin/env node
/**
 * E2E: video upload → server persists media → done event carries userMediaIds
 * → /api/media serves the clip (range requests) — the exact iPhone flow.
 *
 * Uses a throwaway account/session and cleans up after itself.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const ACCOUNT = `acct_e2e_${Date.now()}`;
const SESSION = `sess-e2e-${Date.now()}`;
const VIDEO = "/tmp/e2e-test.mp4";

const buf = readFileSync(VIDEO);
const data = buf.toString("base64");
const name = "e2e-message.mp4";
const mimeType = "video/mp4";

function ssePayload(userMsgId, attachmentId) {
  return {
    sessionId: SESSION,
    accountId: ACCOUNT,
    userMessage: {
      id: userMsgId,
      role: "user",
      content: "E2E video playback test",
      createdAt: Date.now(),
      attachments: [
        { id: attachmentId, name, mimeType, kind: "file", dataUrl: undefined },
      ],
    },
    message: "E2E video playback test",
    attachments: [
      { name, mimeType, kind: "file", data },
    ],
    studentProfile: {},
    history: [],
  };
}

function parseSse(text) {
  const events = [];
  for (const part of text.split("\n\n")) {
    const lines = part.split("\n");
    let event = "message";
    let dataLine = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
    if (dataLine) {
      try {
        events.push({ event, data: JSON.parse(dataLine) });
      } catch {
        events.push({ event, data: dataLine });
      }
    }
  }
  return events;
}

const results = {};
let exit = 0;

try {
  // 1. POST /api/chat with the video (server persists media BEFORE streaming).
  const userMsgId = `m_e2e_${Date.now()}`;
  const attachmentId = `a_e2e_${Date.now()}`;
  const started = Date.now();
  const chatRes = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ssePayload(userMsgId, attachmentId)),
  });
  results.chatHttp = chatRes.status;
  if (!chatRes.ok) {
    results.chatBody = await chatRes.text();
    throw new Error(`POST /api/chat returned ${chatRes.status}`);
  }
  const sseText = await chatRes.text();
  results.chatBytes = sseText.length;
  results.chatMs = Date.now() - started;
  const events = parseSse(sseText);
  const done = events.find((e) => e.event === "done");
  const err = events.find((e) => e.event === "error");
  if (err) {
    results.chatError = err.data?.error || "unknown";
    throw new Error(`POST /api/chat error event: ${results.chatError}`);
  }
  if (!done) throw new Error("no done event in stream");
  results.done = done.data;
  const mediaEntry = (done.data?.userMediaIds || []).find(
    (m) => m.attachmentId === attachmentId,
  );
  results.userMediaIdsPresent = Boolean(mediaEntry);
  results.mediaId = mediaEntry?.mediaId || null;

  // 2. Verify media file exists on disk.
  let diskExists = false;
  if (mediaEntry?.mediaId) {
    const mediaDir = "/root/codes/ryan_learning/data/media";
    const exists =
      execSync(`ls ${mediaDir}/${mediaEntry.mediaId}.bin 2>/dev/null`).toString().trim();
    diskExists = Boolean(exists);
    results.diskExists = diskExists;
    results.diskBytes = diskExists
      ? Number(execSync(`stat -c %s ${mediaDir}/${mediaEntry.mediaId}.bin`).toString().trim())
      : 0;
  }

  // 3. GET /api/media/{mediaId} — full + Range request.
  if (mediaEntry?.mediaId) {
    const mid = encodeURIComponent(mediaEntry.mediaId);
    const fullRes = await fetch(`${BASE}/api/media/${mid}`);
    results.mediaHttp = fullRes.status;
    results.mediaContentType = fullRes.headers.get("content-type");
    const body = await fullRes.arrayBuffer();
    results.mediaBodyBytes = body.byteLength;

    const rangeRes = await fetch(`${BASE}/api/media/${mid}`, {
      headers: { Range: "bytes=0-1023" },
    });
    results.rangeHttp = rangeRes.status;
    results.rangeContentRange = rangeRes.headers.get("content-range");
    results.rangeAcceptRanges = rangeRes.headers.get("accept-ranges");
    const rBody = await rangeRes.arrayBuffer();
    results.rangeBodyBytes = rBody.byteLength;
  }

  // 4. Verify history record has mediaId (server-side authoritative copy).
  const histRes = await fetch(
    `${BASE}/api/history?accountId=${encodeURIComponent(ACCOUNT)}`,
  );
  const hist = await histRes.json();
  const conv = (hist.conversations || []).find((c) => c.sessionId === SESSION);
  const savedMsg = conv?.messages?.find((m) => m.id === userMsgId);
  results.historyHasMsg = Boolean(savedMsg);
  results.historyMediaId = savedMsg?.attachments?.[0]?.mediaId || null;
  results.historyMediaMatches = Boolean(
    mediaEntry?.mediaId && savedMsg?.attachments?.[0]?.mediaId === mediaEntry.mediaId,
  );

  // Cleanup: delete the throwaway session + media.
  await fetch(
    `${BASE}/api/history?sessionId=${encodeURIComponent(SESSION)}&accountId=${encodeURIComponent(ACCOUNT)}`,
    { method: "DELETE" },
  );
  if (mediaEntry?.mediaId) {
    const mediaDir = "/root/codes/ryan_learning/data/media";
    execSync(`rm -f ${mediaDir}/${mediaEntry.mediaId}.bin ${mediaDir}/${mediaEntry.mediaId}.json`);
  }
} catch (err) {
  results.fatal = err.message;
  exit = 1;
}

console.log(JSON.stringify(results, null, 2));
process.exit(exit);
