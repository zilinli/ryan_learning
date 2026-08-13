/**
 * One-time cleanup: remove Ryan's conversations that leaked into the
 * acct_ching history directory and tombstone them for acct_ching so
 * (a) the client drops them on next hydrate and (b) the server refuses
 * to re-upload them under Ching's account.
 *
 * The 5 sessionIds below were verified (see debug logs) to exist in BOTH
 * data/conversations (Ryan's legacy dir) and data/history/acct_ching.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHING_DIR = path.join(ROOT, "data", "history", "acct_ching");
const DELETIONS = path.join(ROOT, "data", "deletions", "acct_ching.json");

const LEAKED = [
  "0ae99fed-da0d-496d-95b4-f80504b7ba9b",
  "2051edc5-4215-493a-8c71-63a41d3d072c",
  "7145f98a-14c8-4286-a6b8-c6ef6411bb2c",
  "afd460eb-3093-460c-b9cf-02522bfe6e48",
  "b0674173-d6e5-46fb-80db-809c15d23a8c",
];

async function main() {
  let removed = 0;
  for (const sid of LEAKED) {
    const file = path.join(CHING_DIR, `${sid}.json`);
    try {
      await fs.unlink(file);
      removed += 1;
      console.log(`deleted ${path.basename(file)}`);
    } catch {
      console.log(`skip (not present): ${sid}`);
    }
  }

  // Append tombstones for acct_ching (read-modify-write, keep existing).
  let log = {};
  try {
    log = JSON.parse(await fs.readFile(DELETIONS, "utf8"));
  } catch {
    log = {};
  }
  const now = Date.now();
  let wrote = 0;
  for (const sid of LEAKED) {
    if (typeof log[sid] !== "number") {
      log[sid] = now;
      wrote += 1;
    }
  }
  await fs.mkdir(path.dirname(DELETIONS), { recursive: true });
  await fs.writeFile(DELETIONS, JSON.stringify(log), "utf8");
  console.log(`tombstoned ${wrote} session(s) for acct_ching`);

  const chingLeft = (await fs.readdir(CHING_DIR)).filter((n) => n.endsWith(".json"));
  console.log(`remaining acct_ching files: ${chingLeft.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
