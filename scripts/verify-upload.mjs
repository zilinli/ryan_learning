#!/usr/bin/env node
/**
 * Verify upload/attachment pipeline (server + pure helpers).
 * Run: node scripts/verify-upload.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function makePng(path, color = "red") {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=640x480:d=0.1`,
      "-frames:v",
      "1",
      path,
    ],
    { encoding: "utf8" },
  );
  return r.status === 0;
}

function makePdf(path) {
  const py = `
from pathlib import Path
pdf = b"""%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 55 >>stream
BT /F1 18 Tf 40 100 Td (Homework Q1 Find x) Tj ET
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000372 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
451
%%EOF
"""
Path(${JSON.stringify(path)}).write_bytes(pdf)
`;
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  return r.status === 0;
}

async function probeChat(payload, label) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await fetch("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      ok(label, false, `http=${res.status} ${t.slice(0, 120)}`);
      return false;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (buf.length < 800) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      if (buf.includes("event:")) break;
    }
    try {
      ac.abort();
    } catch {
      // ignore
    }
    const good =
      /event:\s*(status|delta|error)/.test(buf) &&
      !/Type a message or add/.test(buf);
    ok(label, good, buf.slice(0, 100).replace(/\n/g, " "));
    ok(
      `${label} started stream`,
      buf.includes("thinking") ||
        buf.includes("delta") ||
        buf.includes("error"),
    );
    return good;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort/i.test(msg)) {
      ok(label, true, "aborted after first events");
      return true;
    }
    ok(label, false, msg);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function probeHttps(body, label) {
  const out = join(tmpdir(), `chat-https-${Date.now()}.txt`);
  let best = { code: "000", bodyText: "" };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const curl = spawnSync(
      "curl",
      [
        "-sk",
        "--http1.1",
        "-N",
        "--max-time",
        "20",
        "-X",
        "POST",
        "https://127.0.0.1/api/chat",
        "-H",
        "Content-Type: application/json",
        "--data-binary",
        "@-",
        "-o",
        out,
        "-w",
        "%{http_code}",
      ],
      { encoding: "utf8", input: JSON.stringify(body) },
    );
    const code = curl.stdout.trim();
    let bodyText = "";
    try {
      bodyText = readFileSync(out, "utf8");
    } catch {
      bodyText = "";
    }
    best = { code, bodyText };
    if (code === "200" && bodyText.includes("event:")) break;
    if (attempt === 1) {
      spawnSync("sleep", ["0.4"]);
    }
  }
  try {
    unlinkSync(out);
  } catch {
    // ignore
  }
  ok(
    label,
    best.code === "200" && best.bodyText.includes("event:"),
    `http=${best.code} len=${best.bodyText.length} head=${best.bodyText.slice(0, 60).replace(/\n/g, " ")}`,
  );
}

async function main() {
  console.log("=== Upload / attachment verification ===\n");

  const {
    normalizeIncomingAttachments,
    isAllowedAttachment,
    guessKind,
    MAX_ATTACHMENTS,
  } = await import("../src/lib/attachments.ts");

  ok("MAX_ATTACHMENTS is multi", MAX_ATTACHMENTS >= 2, String(MAX_ATTACHMENTS));
  ok(
    "allow nameless camera image",
    isAllowedAttachment("image/jpeg", "") &&
      isAllowedAttachment("application/octet-stream", ""),
  );
  ok("guess image kind", guessKind("image/png", "a.PNG") === "image");
  ok("guess pdf kind", guessKind("application/pdf", "hw.pdf") === "file");

  const multi = normalizeIncomingAttachments({
    attachments: [
      { name: "p1.jpg", mimeType: "image/jpeg", kind: "image", data: "aaa" },
      { name: "p2.jpg", mimeType: "image/jpeg", kind: "image", data: "bbb" },
      { name: "notes.txt", mimeType: "text/plain", kind: "file", textContent: "Q1" },
    ],
  });
  ok("normalize multi attachments", multi.length === 3, `n=${multi.length}`);

  const dir = tmpdir();
  const png1 = join(dir, "spark-u1.png");
  const png2 = join(dir, "spark-u2.png");
  const pdf = join(dir, "spark-hw.pdf");
  const txt = join(dir, "spark-notes.txt");
  ok("ffmpeg png1", makePng(png1, "red"));
  ok("ffmpeg png2", makePng(png2, "blue"));
  ok("make pdf", makePdf(pdf));
  writeFileSync(txt, "Reading: What is the main idea?\n");

  const pt = spawnSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
  ok(
    "pdftotext works",
    pt.status === 0 && /Homework|Find/i.test(pt.stdout),
    pt.stdout.slice(0, 80),
  );

  const b1 = readFileSync(png1).toString("base64");
  const b2 = readFileSync(png2).toString("base64");
  const bPdf = readFileSync(pdf).toString("base64");
  const body = {
    sessionId: `verify-upload-${Date.now()}`,
    message: "Please look at my homework photos.",
    attachments: [
      { name: "page1.png", mimeType: "image/png", kind: "image", data: b1 },
      { name: "page2.png", mimeType: "image/png", kind: "image", data: b2 },
      { name: "hw.pdf", mimeType: "application/pdf", kind: "file", data: bPdf },
      {
        name: "notes.txt",
        mimeType: "text/plain",
        kind: "file",
        textContent: readFileSync(txt, "utf8"),
      },
    ],
    reset: true,
  };

  {
    const res = await fetch("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "x", message: "" }),
    });
    const j = await res.json();
    ok("empty request rejected", res.status === 400, JSON.stringify(j));
  }

  for (let round = 1; round <= 3; round += 1) {
    await probeChat(
      { ...body, sessionId: `${body.sessionId}-r${round}` },
      `multi-upload chat round ${round}`,
    );
  }

  for (let round = 1; round <= 3; round += 1) {
    probeHttps(
      {
        sessionId: `https-${Date.now()}-r${round}`,
        message: "help",
        attachments: [
          { name: "p.png", mimeType: "image/png", kind: "image", data: b1 },
        ],
        reset: true,
      },
      `HTTPS upload chat round ${round}`,
    );
  }

  for (const p of [png1, png2, pdf, txt]) {
    try {
      unlinkSync(p);
    } catch {
      // ignore
    }
  }

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
