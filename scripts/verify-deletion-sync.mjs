#!/usr/bin/env node
/**
 * Cross-device deletion sync integration test.
 *
 * Simulates two devices against the live Spark API:
 *   1. Device A uploads a conversation
 *   2. Device B sees it
 *   3. Device A deletes it (tombstone + JSON + media removed)
 *   4. Device B sees it gone + deletions map has the tombstone
 *   5. Device B (stale local copy) re-uploads it -> server MUST reject
 *   6. Device B confirms it is still gone (no resurrection)
 *
 * Run: npm run verify:deletion-sync
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.SPARK_BASE_URL || "http://127.0.0.1:3000";
const AID = `acct_verify_del_${Date.now()}`;
const SID = `vds_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
const now = Date.now();

let failures = 0;
function check(label, cond, extra = "") {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    failures += 1;
    console.error(`  ❌ ${label} ${extra}`);
  }
}

async function api(pathname, init) {
  const res = await fetch(`${BASE}${pathname}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { res, json };
}

function makeConversation(withMedia = false) {
  const messages = [
    {
      id: `m_${SID}_1`,
      role: "user",
      content: "Integration test message",
      createdAt: now,
    },
    {
      id: `m_${SID}_2`,
      role: "assistant",
      content: "Reply from tutor",
      createdAt: now + 1,
    },
  ];
  if (withMedia) {
    messages[0].attachments = [
      {
        id: "att_1",
        name: "note.txt",
        mimeType: "text/plain",
        kind: "file",
        dataUrl: "data:text/plain;base64,aGVsbG8gd29ybGQgaW50ZWdyYXRpb24=",
      },
    ];
  }
  return {
    sessionId: SID,
    title: "Deletion sync test",
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

function historyFilePath() {
  return path.join(ROOT, "data", "history", AID, `${SID}.json`);
}

function deletionsFilePath() {
  return path.join(ROOT, "data", "deletions", `${AID}.json`);
}

async function mediaForSession() {
  const dir = path.join(ROOT, "data", "media");
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const ids = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
      if (meta.sessionId === SID) ids.push(meta.mediaId);
    } catch {
      /* skip */
    }
  }
  return ids;
}

async function cleanup() {
  try {
    await fs.unlink(historyFilePath());
  } catch {}
  try {
    await fs.unlink(deletionsFilePath());
  } catch {}
  const dir = path.join(ROOT, "data", "history", AID);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
  for (const mediaId of await mediaForSession()) {
    try {
      await fs.unlink(path.join(ROOT, "data", "media", `${mediaId}.bin`));
    } catch {}
    try {
      await fs.unlink(path.join(ROOT, "data", "media", `${mediaId}.json`));
    } catch {}
  }
}

console.log("=== Cross-device deletion sync verification ===\n");
console.log(`Target: ${BASE}\nAccount: ${AID}\nSession: ${SID}\n`);

try {
  // 1. Device A uploads the conversation (with a media file)
  const conv = makeConversation(true);
  let r = await api(
    `/api/history`,
    {
      method: "PUT",
      body: JSON.stringify({ accountId: AID, conversations: [conv] }),
    },
  );
  check("Device A uploads conversation (PUT ok)", r.res.ok && r.json?.ok === true);

  // 2. Device B sees it
  r = await api(`/api/history?accountId=${AID}`);
  const bSeesIt = Array.isArray(r.json?.conversations) &&
    r.json.conversations.some((c) => c.sessionId === SID);
  check("Device B can see the conversation (GET)", bSeesIt);
  check("Media file persisted server-side", (await mediaForSession()).length === 1);
  check(
    "Conversation JSON persisted",
    (await fs.stat(historyFilePath()).catch(() => null)) !== null,
  );

  // 3. Device A deletes it
  r = await api(`/api/history?sessionId=${SID}&accountId=${AID}`, {
    method: "DELETE",
  });
  check("Device A deletes (DELETE ok)", r.res.ok && r.json?.ok === true);

  // 4. Device B: gone + tombstone present
  r = await api(`/api/history?accountId=${AID}`);
  const gone = !Array.isArray(r.json?.conversations) ||
    !r.json.conversations.some((c) => c.sessionId === SID);
  check("Device B no longer sees the conversation", gone);
  check(
    "Deletion tombstone attached to GET",
    r.json?.deletions && typeof r.json.deletions[SID] === "number",
  );
  check("Conversation JSON removed", (await fs.stat(historyFilePath()).catch(() => null)) === null);
  check("Media files removed", (await mediaForSession()).length === 0);

  // 5. Device B's stale local copy tries to re-upload -> MUST be rejected
  r = await api(`/api/history`, {
    method: "PUT",
    body: JSON.stringify({ accountId: AID, conversations: [conv] }),
  });
  const saved = Array.isArray(r.json?.conversations)
    ? r.json.conversations.filter((c) => c.sessionId === SID)
    : [];
  check(
    "Stale re-upload is rejected (server PUT guard)",
    saved.length === 0 && r.res.ok,
    `got ${saved.length} resurrected`,
  );

  // 6. Still gone + no files re-created
  r = await api(`/api/history?accountId=${AID}`);
  const stillGone = !Array.isArray(r.json?.conversations) ||
    !r.json.conversations.some((c) => c.sessionId === SID);
  check("Conversation stays deleted (no resurrection)", stillGone);
  check(
    "No JSON / media re-created",
    (await fs.stat(historyFilePath()).catch(() => null)) === null &&
      (await mediaForSession()).length === 0,
  );

  // 7. Control: a brand-new conversation still uploads fine
  const freshSid = `vds_fresh_${Date.now()}`;
  const fresh = {
    ...makeConversation(),
    sessionId: freshSid,
    title: "Fresh control",
  };
  r = await api(`/api/history`, {
    method: "PUT",
    body: JSON.stringify({ accountId: AID, conversations: [fresh] }),
  });
  const freshSaved = Array.isArray(r.json?.conversations) &&
    r.json.conversations.some((c) => c.sessionId === freshSid);
  check("Control: a fresh conversation still uploads", freshSaved);
  await api(`/api/history?sessionId=${freshSid}&accountId=${AID}`, {
    method: "DELETE",
  });
} finally {
  await cleanup();
}

console.log(failures === 0 ? "\n=== Deletion sync PASSED ===" : `\n=== Deletion sync FAILED (${failures}) ===`);
process.exit(failures === 0 ? 0 : 1);
