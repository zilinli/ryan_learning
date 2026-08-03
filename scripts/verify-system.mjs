#!/usr/bin/env node
/**
 * System-level API smoke tests (no browser).
 * Requires: next on :3000, voice service on :8765
 * Run: node scripts/verify-system.mjs
 */
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function readSseDone(url, body, timeoutMs = 120_000) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  const doneMatch = text.match(/event: done\ndata: ({.*})/);
  const errMatch = text.match(/event: error\ndata: ({.*})/);
  return { res, text, done: doneMatch ? JSON.parse(doneMatch[1]) : null, err: errMatch ? JSON.parse(errMatch[1]) : null };
}

async function main() {
  console.log("=== System API smoke verification ===\n");

  // Health
  {
    const setup = await (await fetch("http://127.0.0.1:3000/api/setup")).json();
    ok("setup configured", setup.configured === true, JSON.stringify(setup));

    const health = await (await fetch("http://127.0.0.1:8765/health")).json();
    ok("voice health", health.ok === true, `model=${health.model}`);

    const modelsRes = await fetch("http://127.0.0.1:3000/api/models");
    const models = await modelsRes.json();
    ok(
      "models list",
      modelsRes.ok && Array.isArray(models.models) && models.models.length > 0,
      `n=${models.models?.length ?? 0}`,
    );
  }

  // Validation
  {
    const bad = await fetch("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const j = await bad.json();
    ok("chat rejects missing sessionId", bad.status === 400 && /sessionId/i.test(j.error || ""), j.error);

    const empty = await fetch("http://127.0.0.1:3000/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    ok("tts rejects empty text", empty.status === 400);

    const noAudio = await fetch("http://127.0.0.1:3000/api/transcribe", {
      method: "POST",
      body: new FormData(),
    });
    ok("transcribe rejects empty audio", noAudio.status === 400);
  }

  // Chat streaming (English lock)
  {
    const { res, done, err, text } = await readSseDone("http://127.0.0.1:3000/api/chat", {
      sessionId: `sys-${Date.now()}`,
      message: "Reply with exactly: Ready to help.",
      voiceId: "ava",
      replyLanguage: "en",
    });
    ok("chat SSE http ok", res.ok && res.headers.get("content-type")?.includes("text/event-stream"));
    ok("chat SSE has status", text.includes("event: status"));
    ok(
      "chat SSE done with text",
      !err && typeof done?.text === "string" && done.text.length > 0,
      done?.text?.slice(0, 80) || err?.error || "no done",
    );
  }

  // Chat language lock (Mandarin)
  {
    const { done, err } = await readSseDone("http://127.0.0.1:3000/api/chat", {
      sessionId: `sys-zh-${Date.now()}`,
      message: "用一句话跟我问好。",
      voiceId: "yunxi",
    });
    const reply = done?.text || "";
    const han = (reply.match(/[\u4e00-\u9fff]/g) || []).length;
    ok(
      "chat Mandarin voice yields Chinese",
      !err && han >= 2,
      `han=${han} text="${reply.slice(0, 60)}"`,
    );
  }

  // Page shell
  {
    const page = await fetch("http://127.0.0.1:3000/");
    const html = await page.text();
    ok("home page 200", page.ok);
    ok("home page has app shell", /Spark|tutor|html/i.test(html));
  }

  // Global history API
  {
    const id = `syshist_${Date.now()}`;
    const put = await fetch("http://127.0.0.1:3000/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation: {
          sessionId: id,
          title: "System history check",
          messages: [
            {
              id: "m1",
              role: "user",
              content: "Remember this globally",
              createdAt: Date.now(),
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }),
    });
    const putBody = await put.json();
    ok("history PUT saves chat", put.ok && putBody.ok, JSON.stringify(putBody));

    const list = await (await fetch("http://127.0.0.1:3000/api/history")).json();
    ok(
      "history GET lists chat",
      Array.isArray(list.conversations) &&
        list.conversations.some((c) => c.sessionId === id),
      `n=${list.conversations?.length ?? 0}`,
    );

    const del = await fetch(
      `http://127.0.0.1:3000/api/history?sessionId=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    ok("history DELETE removes chat", del.ok);

    // Keyword search
    const id2 = `syshist_q_${Date.now()}`;
    await fetch("http://127.0.0.1:3000/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation: {
          sessionId: id2,
          title: "Algebra homework",
          messages: [
            {
              id: "m1",
              role: "user",
              content: "Solve the quadratic equation carefully",
              createdAt: Date.now(),
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }),
    });
    const searched = await (
      await fetch("http://127.0.0.1:3000/api/history?q=quadratic")
    ).json();
    ok(
      "history search by keyword",
      Array.isArray(searched.conversations) &&
        searched.conversations.some((c) => c.sessionId === id2),
      `n=${searched.conversations?.length ?? 0}`,
    );
    const stats = await (
      await fetch("http://127.0.0.1:3000/api/history?stats=1")
    ).json();
    ok(
      "history stats expose message budget",
      stats.stats?.maxMessages === 10000,
      JSON.stringify(stats.stats),
    );
    await fetch(
      `http://127.0.0.1:3000/api/history?sessionId=${encodeURIComponent(id2)}`,
      { method: "DELETE" },
    );
  }

  // Learning memory (cross-session)
  {
    const put = await fetch("http://127.0.0.1:3000/api/learning", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memory: {
          topics: [
            {
              id: "fractions",
              label: "fractions",
              mastery: 70,
              solves: 3,
              lastSeen: Date.now(),
            },
          ],
          recentWins: ["Progress on fractions"],
          recentStruggles: [],
          updatedAt: Date.now(),
        },
      }),
    });
    const putJ = await put.json();
    ok(
      "learning memory PUT",
      put.ok && putJ.ok === true && putJ.memory?.topics?.length >= 1,
      JSON.stringify(putJ.memory?.topics?.[0] || putJ),
    );
    const get = await (await fetch("http://127.0.0.1:3000/api/learning")).json();
    ok(
      "learning memory GET",
      Array.isArray(get.memory?.topics) &&
        get.memory.topics.some((t) => t.id === "fractions"),
      `n=${get.memory?.topics?.length ?? 0}`,
    );
  }

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
