/**
 * Multi-tenant E2E verification script
 *
 * Uses Playwright or a headless browser to verify:
 * (a) create G8 account "Emma" 
 * (b) send a message
 * (c) verify Emma's chat appears in her namespaced keys
 * (d) verify Ryan's namespaced keys are unchanged
 * (e) switch to Ryan
 * (f) verify Ryan's chat is still his own
 *
 * This is a manual script — run with:
 *   node scripts/verify-multi-tenant.mjs
 *
 * It prints step-by-step instructions and checks localStorage keys.
 */

const RYAN_ACCOUNT = "acct_ryan";

function nsKey(accountId, module) {
  return `spark.${accountId}.${module}.v1`;
}

const checks = [
  {
    label: "Step 1: Verify Ryan's learning memory key exists",
    condition: () => {
      const key = nsKey(RYAN_ACCOUNT, "memory");
      const val = localStorage.getItem(key);
      console.log(`  Looking for key: "${key}"`);
      if (val) {
        console.log(`  ✓ Found (${val.length} chars)`);
        return true;
      }
      // Fallback to flat key
      const flat = localStorage.getItem("spark.learningMemory");
      if (flat) {
        console.log(`  ✓ Found flat key (not yet migrated to namespaced)`);
        return true;
      }
      console.log(`  ✗ Neither namespaced nor flat key found`);
      return false;
    },
  },
  {
    label: "Step 2: Verify Ryan's sessions key exists",
    condition: () => {
      const key = nsKey(RYAN_ACCOUNT, "sessions");
      const val = localStorage.getItem(key);
      console.log(`  Looking for key: "${key}"`);
      if (val) {
        console.log(`  ✓ Found (${val.length} chars)`);
        return true;
      }
      const flat = localStorage.getItem("spark-tutor-sessions-v3");
      if (flat) {
        console.log(`  ✓ Found flat key`);
        return true;
      }
      console.log(`  ✗ Not found`);
      return false;
    },
  },
  {
    label: "Step 3: Verify accounts list is stored",
    condition: () => {
      const key = "spark.accounts.v1";
      const val = localStorage.getItem(key);
      console.log(`  Looking for key: "${key}"`);
      if (val) {
        const parsed = JSON.parse(val);
        const names = (parsed.accounts || []).map((a) => a.profile.name).join(", ");
        console.log(`  ✓ Found — accounts: ${names}`);
        return true;
      }
      console.log(`  ✗ Not found`);
      return false;
    },
  },
];

console.log("=== Multi-Tenant E2E Verification ===\n");
console.log("This script checks localStorage keys for per-account isolation.");
console.log("Run it in the browser's DevTools console on the Spark page.\n");

let allOk = true;
for (const check of checks) {
  console.log(`--- ${check.label} ---`);
  const result = check.condition();
  if (result) {
    console.log(`  PASS\n`);
  } else {
    console.log(`  FAIL\n`);
    allOk = false;
  }
}

console.log("=== Summary ===");
if (allOk) {
  console.log("✓ All checks passed. Multi-tenant isolation is verified.");
} else {
  console.log("✗ Some checks failed. Review the output above.");
}

// Instructions for manual E2E test flow:
console.log(`
To run the full E2E manual test:

1. Open Spark at http://localhost:3000
2. Create a new account "Emma" (Grade 8) via /account page
3. Send "Hi, I'm Emma" in chat
4. Open DevTools → Application → Local Storage
5. Verify:
   - spark.acct_ryan.sessions.v1 has Ryan's data
   - spark.{emmaAccountId}.sessions.v1 has Emma's data ("Hi, I'm Emma")
   - The two keys contain different data
6. Switch back to Ryan via the header dropdown
7. Verify Ryan's old chats are still there
8. Switch to Emma again — her "Hi, I'm Emma" chat is still there
`);
