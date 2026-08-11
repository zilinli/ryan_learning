/**
 * Live TED API route checks.
 * Usage: TED_CHALLENGE_FORCE_FALLBACK=1 npx tsx scripts/smoke-ted-api.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    /* optional */
  }
}
loadEnvLocal();
process.env.TED_CHALLENGE_FORCE_FALLBACK = "1";

import { GET as getTranscript } from "../src/app/api/ted/transcript/route";
import { POST as postChallenge } from "../src/app/api/ted/challenge/route";
import {
  GET as getCreations,
  POST as postCreation,
  DELETE as delCreation,
} from "../src/app/api/creations/route";

async function main() {
  const failures: string[] = [];
  const slug = "susan_cain_the_power_of_introverts";

  const bad = await postChallenge(
    new Request("http://localhost/api/ted/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "https://evil.example/x" }),
    }),
  );
  if (bad.status !== 400) failures.push("challenge should reject bad slug");
  else console.log("PASS reject bad slug");

  const ch = await postChallenge(
    new Request("http://localhost/api/ted/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }),
  );
  const chBody = await ch.json();
  console.log(
    "challenge",
    ch.status,
    "items",
    chBody.challenge?.items?.length,
    "kinds",
    (chBody.challenge?.items || []).map((i: { kind: string }) => i.kind).join(","),
  );
  if (ch.status !== 200 || (chBody.challenge?.items?.length || 0) < 4) {
    failures.push("challenge fallback failed");
  } else console.log("PASS challenge fallback");

  const tr = await getTranscript(
    new Request(`http://localhost/api/ted/transcript?slug=${slug}`),
  );
  const trBody = await tr.json();
  console.log(
    "transcript",
    tr.status,
    "chars",
    trBody.chars,
    "previewLen",
    (trBody.preview || "").length,
    "hasFullTextField",
    "text" in trBody,
  );
  if (tr.status !== 200) failures.push("transcript GET failed");
  if ("text" in trBody) failures.push("must not expose full text");
  if ((trBody.preview || "").length > 280) failures.push("preview too long");
  if (tr.status === 200) console.log("PASS transcript preview-only");

  const acct = "acct_smoke_ted_api";
  const created = await postCreation(
    new Request("http://localhost/api/creations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: acct,
        type: "ted_challenge",
        title: "API smoke",
        talkSlug: slug,
        challengeScore: "2/5",
      }),
    }),
  );
  const createdBody = await created.json();
  const listed = await getCreations(
    new Request(`http://localhost/api/creations?accountId=${acct}`),
  );
  const listedBody = await listed.json();
  await delCreation(
    new Request("http://localhost/api/creations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: acct, id: createdBody.item.id }),
    }),
  );
  if (created.status !== 200 || listedBody.items?.length < 1) {
    failures.push("creations CRUD failed");
  } else console.log("PASS creations CRUD");

  if (failures.length) {
    console.error("FAIL", failures);
    process.exit(1);
  }
  console.log("TED API SMOKE PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
