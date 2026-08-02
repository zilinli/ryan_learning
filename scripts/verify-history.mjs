#!/usr/bin/env node
/**
 * Verify conversation history helpers (limits + title + slim).
 * Run: node --experimental-strip-types scripts/verify-history.mjs
 * or via ts import path used by verify-upload.
 */
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("=== History / storage verification ===\n");
  const mod = await import("../src/lib/storage.ts");
  const {
    MAX_CONVERSATIONS,
    MAX_MESSAGES_PER_CHAT,
    titleFromMessages,
    slimMessages,
    newSessionId,
  } = mod;

  ok("MAX_CONVERSATIONS capped", MAX_CONVERSATIONS <= 30, String(MAX_CONVERSATIONS));
  ok("MAX_MESSAGES capped", MAX_MESSAGES_PER_CHAT <= 120, String(MAX_MESSAGES_PER_CHAT));
  ok("session id", typeof newSessionId() === "string" && newSessionId().length > 8);

  const title = titleFromMessages([
    { id: "1", role: "user", content: "Help me with fractions please", createdAt: 1 },
  ]);
  ok("title from first user msg", title.includes("fractions"), title);

  const big = Array.from({ length: 120 }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 ? "assistant" : "user",
    content: "x".repeat(100),
    createdAt: i,
    attachments: [
      {
        id: `a${i}`,
        name: "p.jpg",
        mimeType: "image/jpeg",
        kind: "image",
        dataUrl: "data:image/jpeg;base64," + "A".repeat(5000),
      },
    ],
  }));

  const slimActive = slimMessages(big, true);
  const slimInactive = slimMessages(big, false);
  ok(
    "trim messages to max",
    slimActive.length === MAX_MESSAGES_PER_CHAT,
    `n=${slimActive.length}`,
  );
  ok(
    "inactive strips dataUrl",
    slimInactive.every((m) => !m.attachments?.[0]?.dataUrl),
  );
  ok(
    "active keeps last preview",
    Boolean(slimActive[slimActive.length - 1]?.attachments?.[0]?.dataUrl),
  );

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
