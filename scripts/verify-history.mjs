#!/usr/bin/env node
/**
 * Verify conversation history helpers (limits + title + slim + retention).
 * Uses Vitest so TypeScript path resolution matches the app (Node strip-types
 * cannot resolve extensionless relative imports in the graph).
 * Run: npm run verify:history
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "src/lib/storage.test.ts",
  "src/lib/history-retention.test.ts",
  "src/lib/history-merge.test.ts",
  "src/lib/history-store.test.ts",
];

console.log("=== History / storage verification ===\n");
const r = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    ...files,
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);

if ((r.status ?? 1) !== 0) {
  console.error("\nHistory verification FAILED");
  process.exit(r.status ?? 1);
}
console.log("\n=== History verification PASSED ===");
